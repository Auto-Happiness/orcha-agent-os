import { mutation, query, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { checkMembership } from "./authUtils";

/**
 * Mutation to store a new NL-to-SQL query mapping in semanticMemory.
 */
export const storeQueryMapping = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    question: v.string(),
    sql: v.string(),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.apiKey) {
      const auth = await checkMembership(ctx, args.organizationId, args.apiKey);
      if (!auth) throw new Error("Unauthorized membership check failed");
    }

    const now = Date.now();
    const memoryId = await ctx.db.insert("semanticMemory", {
      organizationId: args.organizationId,
      configId: args.configId,
      question: args.question,
      sql: args.sql,
      createdAt: now,
    });

    // Schedule background action to generate embeddings for this new memory
    const config = await ctx.db.get(args.configId);
    const provider = config?.memoryProvider || "local";

    await ctx.scheduler.runAfter(0, internal.semanticMemory.generateMemoryEmbedding, {
      organizationId: args.organizationId,
      memoryId,
      question: args.question,
      provider: provider as any,
      apiKey: args.apiKey,
    });

    return { success: true, memoryId };
  },
});

/**
 * Internal mutation to update the embedding fields of a semanticMemory record.
 */
export const internalUpdateMemoryEmbedding = internalMutation({
  args: {
    id: v.id("semanticMemory"),
    embedding: v.array(v.float64()),
    dimensions: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const update: any = {};
    if (args.dimensions === 384) update.embedding_384 = args.embedding;
    else if (args.dimensions === 768) update.embedding_768 = args.embedding;
    else if (args.dimensions === 1024) update.embedding_1024 = args.embedding;
    else if (args.dimensions === 1536) update.embedding_1536 = args.embedding;
    else {
      console.warn(`[SemanticMemory] Unsupported embedding dimension count: ${args.dimensions}`);
      return;
    }
    await ctx.db.patch(args.id, update);
  },
});

/**
 * Internal action to generate embedding for a saved query memory.
 */
export const generateMemoryEmbedding = internalAction({
  args: {
    organizationId: v.id("organizations"),
    memoryId: v.id("semanticMemory"),
    question: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.question.trim();
    if (!trimmed) {
      console.log(`[SemanticMemory] Empty question for memory ${args.memoryId}, skipping embedding.`);
      return;
    }
    console.log(`[SemanticMemory] Generating embedding for memory ${args.memoryId} via ${args.provider}`);
    try {
      const { embedding, dimensions } = await ctx.runAction(internal.embeddings.internalGenerateEmbedding, {
        organizationId: args.organizationId,
        text: trimmed,
        provider: args.provider,
      });

      await ctx.runMutation(internal.semanticMemory.internalUpdateMemoryEmbedding, {
        id: args.memoryId,
        embedding,
        dimensions,
      });
      console.log(`[SemanticMemory] Embedding successfully indexed for memory ${args.memoryId}`);
    } catch (err: any) {
      console.error(`[SemanticMemory] Failed to generate embedding for memory ${args.memoryId}: ${err.message}`);
    }
  },
});

/**
 * Action to recall similar past queries using vector search.
 */
export const recallQueries = action({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    embedding: v.array(v.float64()),
    indexName: v.union(
      v.literal("by_embedding_384"),
      v.literal("by_embedding_768"),
      v.literal("by_embedding_1024"),
      v.literal("by_embedding_1536")
    ),
    limit: v.optional(v.number()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<{ question: string; sql: string }>> => {
    if (args.apiKey) {
      const config = await ctx.runQuery(api.semanticModels.checkConfigAccess, {
        configId: args.configId,
        apiKey: args.apiKey
      });
    }

    try {
      const searchResults = await ctx.vectorSearch("semanticMemory", args.indexName, {
        vector: args.embedding,
        filter: (q) => q.eq("configId", args.configId),
        limit: args.limit || 3,
      });

      if (searchResults.length === 0) {
        return [];
      }

      // Fetch the actual text fields for the returned results
      const recalled = await ctx.runQuery(internal.semanticMemory.resolveMemoryDetails, {
        memoryIds: searchResults.map((r) => r._id),
      });

      return recalled;
    } catch (err: any) {
      if (err.message?.includes("bootstrapping")) {
        console.warn("[SemanticMemory] Search index is bootstrapping, returning empty matches.");
        return [];
      }
      console.error("[SemanticMemory] Search failed:", err);
      return [];
    }
  },
});

/**
 * Internal query to resolve raw semanticMemory document details.
 */
export const resolveMemoryDetails = internalQuery({
  args: { memoryIds: v.array(v.id("semanticMemory")) },
  handler: async (ctx, args) => {
    const list = [];
    for (const id of args.memoryIds) {
      const doc = await ctx.db.get(id);
      if (doc) {
        list.push({
          question: doc.question,
          sql: doc.sql,
        });
      }
    }
    return list;
  },
});

/**
 * Query to list all semantic memories (query history) for a configuration.
 */
export const listByConfig = query({
  args: {
    configId: v.id("databaseConfigs"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) return [];

    await checkMembership(ctx, config.organizationId);

    return await ctx.db
      .query("semanticMemory")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .order("desc")
      .collect();
  },
});

/**
 * Mutation to delete a specific semantic query memory.
 */
export const remove = mutation({
  args: {
    id: v.id("semanticMemory"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Mutation to delete multiple semantic query memories in bulk.
 */
export const removeBulk = mutation({
  args: {
    ids: v.array(v.id("semanticMemory")),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    await Promise.all(args.ids.map((id) => ctx.db.delete(id)));
    return { success: true };
  },
});

/**
 * Mutation to manually seed a NL-to-SQL query memory mapping.
 */
export const createManualMapping = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    question: v.string(),
    sql: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);

    const now = Date.now();
    const memoryId = await ctx.db.insert("semanticMemory", {
      organizationId: args.organizationId,
      configId: args.configId,
      question: args.question,
      sql: args.sql,
      createdAt: now,
    });

    const config = await ctx.db.get(args.configId);
    const provider = config?.memoryProvider || "local";

    await ctx.scheduler.runAfter(0, internal.semanticMemory.generateMemoryEmbedding, {
      organizationId: args.organizationId,
      memoryId,
      question: args.question,
      provider: provider as any,
    });

    return { success: true, memoryId };
  },
});

/**
 * Mutation to manually seed multiple NL-to-SQL query mappings in bulk.
 */
export const bulkCreateManualMappings = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    mappings: v.array(
      v.object({
        question: v.string(),
        sql: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);

    const config = await ctx.db.get(args.configId);
    const provider = config?.memoryProvider || "local";
    const now = Date.now();
    const results = [];

    await Promise.all(
      args.mappings.map(async (mapping) => {
        const memoryId = await ctx.db.insert("semanticMemory", {
          organizationId: args.organizationId,
          configId: args.configId,
          question: mapping.question,
          sql: mapping.sql,
          createdAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.semanticMemory.generateMemoryEmbedding, {
          organizationId: args.organizationId,
          memoryId,
          question: mapping.question,
          provider: provider as any,
        });

        results.push(memoryId);
      })
    );

    return { success: true, count: results.length };
  },
});

