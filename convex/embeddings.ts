"use node";

import { action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { KeyManager } from "../lib/key-manager";

/**
 * Helper to determine if a key is encrypted and decrypt it if necessary.
 */
function decryptKeyIfNeeded(key: string, organizationId: string): string {
  const parts = key.split(":");
  if (parts.length !== 3) {
    console.log("[Embeddings] Key is not in 3-part encrypted format, using as-is.");
    return key;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const hexRe = /^[0-9a-f]+$/i;

  const isEncrypted =
    ivHex.length === 32 &&
    authTagHex.length === 32 &&
    encryptedHex.length > 0 &&
    hexRe.test(ivHex) &&
    hexRe.test(authTagHex) &&
    hexRe.test(encryptedHex);

  if (!isEncrypted) {
    console.log("[Embeddings] Key has colons but failed encryption heuristic, using as-is.");
    return key;
  }

  try {
    if (!process.env.ENCRYPTION_KEY) {
      console.error("[Embeddings] ENCRYPTION_KEY environment variable is missing in Convex!");
      return key;
    }
    return KeyManager.decrypt(key, organizationId);
  } catch (err) {
    console.error("[Embeddings] Decryption failed, using raw key:", err);
    return key;
  }
}


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
    sysApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    const keyDoc: Doc<"aiKeys"> | null = await ctx.runQuery(api.aiKeys.getByProvider, {
      organizationId: args.organizationId,
      provider: args.provider,
      apiKey: args.sysApiKey
    });

    if (!keyDoc && args.provider !== "local") {
      throw new Error(`API Key for ${args.provider} not found in organization.`);
    }

    const rawKey = keyDoc ? decryptKeyIfNeeded(keyDoc.keyValue, args.organizationId) : undefined;

    return await fetchEmbedding(
      args.organizationId,
      args.text,
      args.provider,
      rawKey,
      args.model
    );
  },
});


export const indexConfigSchema = action({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; total: number; providerUsed?: string }> => {
    console.log(`[Embeddings] Orchestrating background indexing for config ${args.configId}`);

    const config = await ctx.runQuery(internal.databaseConfigs.internalGetById, { configId: args.configId });
    if (config?.indexingStatus === "processing") {
      console.log(`[Embeddings] Indexing already in progress for config ${args.configId}`);
      return { success: false, total: config.indexingTotal || 0, providerUsed: config.memoryProvider };
    }

    let models: any[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await ctx.runQuery(internal.semanticModels.internalListModelSummariesByConfig, { configId: args.configId, paginationOpts: { numItems: 1000, cursor: null } });
      models = res.page;
      if (models.length > 0) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    if (models.length === 0) return { success: false, total: 0 };

    let provider = args.provider;
    let resolvedApiKey = args.apiKey;

    if (!resolvedApiKey && provider !== "local") {
      const allKeys = await ctx.runQuery(internal.aiKeys.internalListByOrganization, {
        organizationId: args.organizationId
      });
      const fallback = allKeys.find((k: any) => k.provider === "openai" || k.provider === "gemini");
      if (fallback) {
        provider = fallback.provider as any;
        resolvedApiKey = fallback.keyValue;
      }
    }

    if (!resolvedApiKey && provider !== "local") {
      throw new Error(`No API key available for provider ${provider}`);
    }

    const rawApiKey = resolvedApiKey ? decryptKeyIfNeeded(resolvedApiKey, args.organizationId) : undefined;

    await ctx.runMutation(internal.databaseConfigs.internalUpdateMemoryProvider, {
      configId: args.configId,
      provider: provider as any,
    });

    await ctx.runMutation(internal.databaseConfigs.updateIndexingStatus, {
      configId: args.configId,
      status: "processing",
      total: models.length,
    });

    const modelIds = models.map(m => m._id);
    await ctx.scheduler.runAfter(0, internal.embeddings.processEmbeddingBatch, {
      organizationId: args.organizationId,
      configId: args.configId,
      modelIds,
      provider: provider as any,
      apiKey: rawApiKey!,
      batchSize: 5,
    });

    console.log(`[Embeddings] Background indexing dispatched for ${models.length} tables.`);
    return { success: true, total: models.length, providerUsed: provider };
  },
});


export const processEmbeddingBatch = internalAction({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    modelIds: v.array(v.id("semanticModels")),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    apiKey: v.string(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const { modelIds, batchSize, organizationId, provider, apiKey, configId } = args;

    const config = await ctx.runQuery(internal.databaseConfigs.internalGetById, { configId });
    if (!config || config.indexingStatus !== "processing") {
      console.log(`[Embeddings] Indexing stopped or cancelled for config ${configId}. Halting worker.`);
      return;
    }

    const toProcess = modelIds.slice(0, batchSize);
    const remaining = modelIds.slice(batchSize);

    console.log(`[Embeddings] Processing batch: ${toProcess.length} tables. Remaining: ${remaining.length}`);

    let successCount = 0;

    for (const modelId of toProcess) {
      const model = await ctx.runQuery(internal.semanticModels.getById, { modelId });
      if (!model) continue;

      const columnNames = model.fields.map((f: any) => f.displayName || f.columnName).join(", ");
      const textToEmbed = `Table: ${model.tableName}. Columns: ${columnNames}. Description: ${model.description || ""}`;

      try {
        const { embedding, dimensions } = await fetchEmbedding(
          organizationId,
          textToEmbed,
          provider as any,
          apiKey,
        );

        await ctx.runMutation(internal.semanticModels.updateModelEmbedding, {
          id: modelId,
          embedding,
          dimensions,
        });
        successCount++;
      } catch (err: any) {
        console.error(`[Embeddings] Failed to index table ${model.tableName}: ${err.message}`);
      }
    }

    // Increment progress in the DB regardless of success to prevent progress bar getting stuck
    await ctx.runMutation(internal.databaseConfigs.incrementIndexingProgress, {
      configId: args.configId,
      increment: toProcess.length,
    });

    if (remaining.length > 0) {
      // Schedule next batch. Backoff to 5s if we hit errors (likely rate limits), else 2s.
      const hasErrors = successCount < toProcess.length;
      const delay = hasErrors ? 5000 : 2000;
      await ctx.scheduler.runAfter(delay, internal.embeddings.processEmbeddingBatch, {
        ...args,
        modelIds: remaining,
      });
    } else {
      console.log(`[Embeddings] Background indexing COMPLETE for config ${configId}`);
      await ctx.runMutation(internal.databaseConfigs.updateIndexingStatus, {
        configId: args.configId,
        status: "completed",
      });
    }
  }
});

/**
 * Public Mutation to stop the indexing process.
 */
export const cancelIndexing = action({
  args: {
    configId: v.id("databaseConfigs"),
  },
  handler: async (ctx, args) => {
    console.log(`[Embeddings] Requesting cancellation for config ${args.configId}`);
    await ctx.runMutation(internal.databaseConfigs.updateIndexingStatus, {
      configId: args.configId,
      status: "cancelled",
    });

    // Best Practice: Wipe partially generated embeddings
    console.log(`[Embeddings] Wiping partial embeddings for cancelled config ${args.configId}`);
    await ctx.runAction(internal.semanticModels.clearEmbeddingsForConfig, {
      configId: args.configId,
    });

    return { success: true };
  },
});