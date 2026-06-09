"use node";

import { action, internalAction, internalMutation } from "./_generated/server";
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
    // Default to the orcha-embedding-transformer service (Docker internal name).
    // Falls back to localhost:5001 for local development outside Docker.
    const endpoint = apiKey || "http://orcha-embeddings:5001";
    const response = await fetch(`${endpoint}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Embedding Service Error: ${JSON.stringify(data)}`);
    const embedding: number[] = data.embedding;
    return { embedding, dimensions: data.dimensions ?? embedding.length };
  }

  throw new Error(`Provider ${provider} not supported for embeddings.`);
}

interface EmbeddingBatchResult {
  embeddings: number[][];
  dimensions: number;
}

async function fetchEmbeddingBatch(
  organizationId: Id<"organizations">,
  texts: string[],
  provider: "gemini" | "openai" | "local",
  apiKey?: string,
  model?: string
): Promise<EmbeddingBatchResult> {
  if (provider === "openai") {
    const selectedModel = model || "text-embedding-3-small";
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: selectedModel }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`OpenAI Error: ${JSON.stringify(data)}`);
    const embeddings = data.data.map((item: any) => item.embedding);
    return { embeddings, dimensions: 1536 };
  }

  if (provider === "gemini") {
    const selectedModel = model || "text-embedding-004";
    const modelPath = selectedModel.startsWith("models/") ? selectedModel : `models/${selectedModel}`;
    const requests = texts.map((t) => ({
      model: modelPath,
      content: { parts: [{ text: t }] },
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(`Gemini Error: ${JSON.stringify(data)}`);
    const embeddings = data.embeddings.map((e: any) => e.values);
    return { embeddings, dimensions: 768 };
  }

  if (provider === "local") {
    const endpoint = apiKey || "http://orcha-embeddings:5001";
    const response = await fetch(`${endpoint}/api/embeddings/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Embedding Service Error: ${JSON.stringify(data)}`);
    return { embeddings: data.embeddings, dimensions: data.dimensions };
  }

  throw new Error(`Provider ${provider} not supported for batch embeddings.`);
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
    return await fetchEmbedding(
      args.organizationId,
      args.text,
      "local",
      undefined,
      args.model
    );
  },
});

/**
 * internalGenerateEmbedding — same as generateEmbedding but uses internalGetByProvider
 * to bypass session auth. Safe to call from background jobs (schedulers, internalActions)
 * that have no Clerk user identity.
 */
export const internalGenerateEmbedding = internalAction({
  args: {
    organizationId: v.id("organizations"),
    text: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    return await fetchEmbedding(
      args.organizationId,
      args.text,
      "local",
      undefined,
      args.model
    );
  },
});

/**
 * Background MDL indexing orchestrator action.
 */
export const indexMdlManifest = action({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; total: number; providerUsed?: string }> => {
    console.log(`[Embeddings] Orchestrating background MDL indexing for config ${args.configId}`);

    const config = await ctx.runQuery(internal.databaseConfigs.internalGetById, { configId: args.configId });
    if (config?.indexingStatus === "processing") {
      console.log(`[Embeddings] Indexing already in progress for config ${args.configId}`);
      return { success: false, total: config.indexingTotal || 0, providerUsed: config.memoryProvider };
    }

    const manifest = await ctx.runQuery(internal.mdlManifests.internalGetByConfig, { configId: args.configId });
    if (!manifest || !manifest.models || manifest.models.length === 0) {
      console.log(`[Embeddings] No models in MDL manifest found for config ${args.configId}`);
      return { success: false, total: 0 };
    }

    const models = manifest.models;

    // --- SMALL-SCHEMA RAG BYPASS ---
    if (models.length <= 12) {
      console.log(`[Embeddings] Small schema detected (models count: ${models.length} <= 12). Bypassing background embedding generation.`);
      await ctx.runMutation(internal.databaseConfigs.updateIndexingStatus, {
        configId: args.configId,
        status: "completed",
        total: models.length,
      });
      await ctx.runMutation(internal.databaseConfigs.incrementIndexingProgress, {
        configId: args.configId,
        increment: models.length,
      });
      return { success: true, total: models.length, providerUsed: "none" };
    }

    const provider = "local";

    await ctx.runMutation(internal.databaseConfigs.internalUpdateMemoryProvider, {
      configId: args.configId,
      provider: "local",
    });

    await ctx.runMutation(internal.databaseConfigs.updateIndexingStatus, {
      configId: args.configId,
      status: "processing",
      total: models.length,
    });

    await ctx.runMutation(internal.semanticSearchIndex.internalClearForConfig, { configId: args.configId });

    await ctx.scheduler.runAfter(0, internal.embeddings.processEmbeddingBatch, {
      organizationId: args.organizationId,
      configId: args.configId,
      models,
      provider: "local",
      apiKey: "",
      batchSize: 25,
    });

    console.log(`[Embeddings] Background MDL indexing dispatched for ${models.length} tables.`);
    return { success: true, total: models.length, providerUsed: provider };
  }
});

/**
 * Internal background batch processor action.
 */
export const processEmbeddingBatch = internalAction({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    models: v.array(v.any()),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    apiKey: v.string(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const { models, batchSize, organizationId, provider, apiKey, configId } = args;

    const config = await ctx.runQuery(internal.databaseConfigs.internalGetById, { configId });
    if (!config || config.indexingStatus !== "processing") {
      console.log(`[Embeddings] Indexing stopped or cancelled for config ${configId}. Halting worker.`);
      return;
    }

    const toProcess = models.slice(0, batchSize);
    const remaining = models.slice(batchSize);

    console.log(`[Embeddings] Processing batch: ${toProcess.length} tables. Remaining: ${remaining.length}`);

    let successCount = 0;

    try {
      const textsToEmbed = toProcess.map((model: any) => {
        const columnContext = (model.columns || []).map((c: any) => 
          `${c.name} (${c.type}): ${c.description || ""}${c.remarks ? ` [Note: ${c.remarks}]` : ""}`
        ).join("; ");
        return `Table: ${model.name}. Description: ${model.description || ""}. Columns: ${columnContext}`;
      });

      const { embeddings, dimensions } = await fetchEmbeddingBatch(
        organizationId,
        textsToEmbed,
        provider as any,
        apiKey,
      );

      for (let i = 0; i < toProcess.length; i++) {
        const model = toProcess[i];
        const embedding = embeddings[i];
        if (embedding) {
          await ctx.runMutation(internal.semanticSearchIndex.internalSave, {
            organizationId,
            configId,
            tableName: model.name,
            description: model.description || "",
            embedding,
            dimensions,
          });
          successCount++;
        } else {
          console.error(`[Embeddings] No embedding returned for table ${model.name}`);
        }
      }
    } catch (err: any) {
      console.error(`[Embeddings] Failed to fetch or save embedding batch: ${err.message}`);
    }

    await ctx.runMutation(internal.databaseConfigs.incrementIndexingProgress, {
      configId: args.configId,
      increment: toProcess.length,
    });

    if (remaining.length > 0) {
      const hasErrors = successCount < toProcess.length;
      const delay = hasErrors ? 5000 : 2000;
      await ctx.scheduler.runAfter(delay, internal.embeddings.processEmbeddingBatch, {
        ...args,
        models: remaining,
      });
    } else {
      console.log(`[Embeddings] Background MDL indexing COMPLETE for config ${configId}`);
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

    console.log(`[Embeddings] Wiping partial search index for cancelled config ${args.configId}`);
    await ctx.runMutation(internal.semanticSearchIndex.internalClearForConfig, {
      configId: args.configId,
    });

    return { success: true };
  },
});