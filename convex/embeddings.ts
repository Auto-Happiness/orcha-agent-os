import { action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}

/**
 * Core logic for generating embeddings, extracted to avoid circularity.
 */
async function fetchEmbedding(
  organizationId: Id<"organizations">,
  text: string,
  provider: "gemini" | "openai" | "local",
  apiKey?: string,
  model?: string
): Promise<EmbeddingResult> {
  if (provider === "openai") {
    const selectedModel = model || "text-embedding-3-small";
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model: selectedModel }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`OpenAI Error: ${JSON.stringify(data)}`);
    return { embedding: data.data[0].embedding, dimensions: 1536 };
  }

  if (provider === "gemini") {
    const selectedModel = model || "text-embedding-004";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text }] },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(`Gemini Error: ${JSON.stringify(data)}`);
    return { embedding: data.embedding.values, dimensions: 768 };
  }

  if (provider === "local") {
    const endpoint = apiKey || "http://localhost:11434";
    const selectedModel = model || "nomic-embed-text";
    const response = await fetch(`${endpoint}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, prompt: text }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Ollama Error: ${JSON.stringify(data)}`);
    const embedding = data.embedding;
    return { embedding, dimensions: embedding.length };
  }

  throw new Error(`Provider ${provider} not supported for embeddings.`);
}

/**
 * Generates an embedding for a string of text using the configured provider.
 */
export const generateEmbedding = action({
  args: {
    organizationId: v.id("organizations"),
    text: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    const keyDoc: Doc<"aiKeys"> | null = await ctx.runQuery(api.aiKeys.getByProvider, { 
      organizationId: args.organizationId, 
      provider: args.provider 
    });

    if (!keyDoc && args.provider !== "local") {
      throw new Error(`API Key for ${args.provider} not found in organization.`);
    }

    return await fetchEmbedding(
      args.organizationId,
      args.text,
      args.provider,
      keyDoc?.keyValue,
      args.model
    );
  },
});

/**
 * Orchestrator: Indexes all tables for a specific database configuration.
 */
export const indexConfigSchema = action({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    apiKey: v.optional(v.string()), // Pre-decrypted by the server (Convex can't use node:crypto)
  },
  handler: async (ctx, args): Promise<{ success: boolean; processed: number; providerUsed?: string }> => {
    console.log(`[Embeddings] Starting indexing for config ${args.configId} (Org: ${args.organizationId})`);
    
    // 1. Retry loop to wait for models to be persisted (Consistency Check)
    let models: any[] = [];
    for (let i = 0; i < 5; i++) {
       models = await ctx.runQuery(api.semanticModels.listModelsByConfig, { configId: args.configId });
       if (models.length > 0) break;
       console.log(`[Embeddings] No models found yet (attempt ${i + 1}), waiting 2s...`);
       await new Promise(r => setTimeout(r, 2000));
    }

    if (models.length === 0) {
      console.warn(`[Embeddings] Aborting: Still no models found for config ${args.configId}`);
      return { success: false, processed: 0 };
    }
    
    // 2. Resolve key — use pre-decrypted key passed from server if available
    let provider = args.provider;
    let resolvedApiKey = args.apiKey;

    if (!resolvedApiKey && provider !== "local") {
      // Fallback: look up from DB (only useful if called directly without server pre-decrypt)
      console.log(`[Embeddings] No apiKey passed — attempting internal key lookup...`);
      const allKeys = await ctx.runQuery(internal.aiKeys.internalListByOrganization, { 
        organizationId: args.organizationId 
      });
      console.log(`[Embeddings] Found ${allKeys.length} total keys for org.`);
      const fallback = allKeys.find(k => k.provider === "openai" || k.provider === "gemini");
      if (fallback) {
        provider = fallback.provider as any;
        // Note: keyValue here will likely be encrypted — this path is a last resort
        resolvedApiKey = fallback.keyValue;
        console.warn(`[Embeddings] WARNING: Using raw (possibly encrypted) keyValue as fallback.`);
      }
    }

    if (!resolvedApiKey && provider !== "local") {
      throw new Error(`No API key available for provider ${provider}`);
    }

    // ── NEW: Record this provider as the canonical Memory Provider for this config ──
    console.log(`[Embeddings] Locking memoryProvider to ${provider} for config ${args.configId}`);
    await ctx.runMutation(internal.databaseConfigs.internalUpdateMemoryProvider, {
      configId: args.configId,
      provider: provider as any,
    });

    console.log(`[Embeddings] Proceeding to index ${models.length} tables using ${provider}...`);

    let successCount = 0;
    for (const model of models) {
      const columnNames = model.fields.map((f: any) => f.displayName || f.columnName).join(", ");
      const textToEmbed = `Table: ${model.tableName}. Columns: ${columnNames}. Description: ${model.description || ""}`;

      try {
        const { embedding, dimensions } = await fetchEmbedding(
          args.organizationId,
          textToEmbed,
          provider as any,
          resolvedApiKey,
        );

        await ctx.runMutation(internal.embeddings.updateModelEmbedding, {
          id: model._id,
          embedding,
          dimensions,
        });
        successCount++;
      } catch (err: any) {
        console.error(`[Embeddings] CRITICAL: Failed to index table ${model.tableName}. Error: ${err.message || err}`);
      }
    }

    console.log(`[Embeddings] COMPLETED: Successfully indexed ${successCount}/${models.length} tables.`);
    return { success: true, processed: successCount, providerUsed: provider };
  },
});

/**
 * Internal mutation to save the vector into the correct field based on dimensions.
 */
export const updateModelEmbedding = internalMutation({
  args: {
    id: v.id("semanticModels"),
    embedding: v.array(v.float64()),
    dimensions: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const update: any = { updatedAt: Date.now() };
    
    if (args.dimensions === 768) update.embedding_768 = args.embedding;
    else if (args.dimensions === 1024) update.embedding_1024 = args.embedding;
    else if (args.dimensions === 1536) update.embedding_1536 = args.embedding;
    else {
      console.warn(`[Embeddings] Unsupported dimension count: ${args.dimensions}`);
      return;
    }

    await ctx.db.patch(args.id, update);
  },
});
