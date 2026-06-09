import { action, mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { checkMembership } from "./authUtils";

/**
 * Action to perform vector search on semanticSearchIndex.
 */
export const searchRelatedModels = action({
  args: {
    configId: v.id("databaseConfigs"),
    embedding: v.array(v.float64()),
    indexName: v.union(
      v.literal("by_embedding_384"),
      v.literal("by_embedding_768"),
      v.literal("by_embedding_1536")
    ),
    limit: v.optional(v.number()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    // Check config access
    const config = await ctx.runQuery(internal.databaseConfigs.internalGetById, {
      configId: args.configId,
    });
    if (!config) throw new Error("Database configuration not found.");

    await ctx.runQuery(internal.semanticSearchIndex.internalCheckConfigAccess, {
      organizationId: config.organizationId,
      apiKey: args.apiKey,
    });

    try {
      return await ctx.vectorSearch("semanticSearchIndex", args.indexName, {
        vector: args.embedding,
        filter: (q) => q.eq("configId", args.configId),
        limit: args.limit || 10,
      });
    } catch (err: any) {
      if (err.message?.includes("bootstrapping")) {
        console.warn("[VectorSearch] Index is bootstrapping, returning empty results.");
        return [];
      }
      throw err;
    }
  },
});

/**
 * Internal query to check config access (called from actions).
 */
export const internalCheckConfigAccess = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId, args.apiKey);
  },
});

/**
 * Internal mutation to clear search indexes for a given config.
 */
export const internalClearForConfig = internalMutation({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("semanticSearchIndex")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }
  },
});

/**
 * Internal mutation to save/upsert a search index row.
 */
export const internalSave = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    tableName: v.string(),
    description: v.optional(v.string()),
    embedding: v.array(v.float64()),
    dimensions: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if an entry already exists for this table in this config
    const existing = await ctx.db
      .query("semanticSearchIndex")
      .withIndex("by_config", (q) =>
        q.eq("configId", args.configId)
      )
      .collect();
      
    const matching = existing.find(r => r.tableName === args.tableName);

    const now = Date.now();
    const update: any = {
      tableName: args.tableName,
      description: args.description,
      updatedAt: now,
    };

    if (args.dimensions === 384) {
      update.embedding_384 = args.embedding;
    } else if (args.dimensions === 768) {
      update.embedding_768 = args.embedding;
    } else if (args.dimensions === 1024) {
      update.embedding_1024 = args.embedding;
    } else if (args.dimensions === 1536) {
      update.embedding_1536 = args.embedding;
    }

    if (matching) {
      await ctx.db.patch(matching._id, update);
      return matching._id;
    } else {
      return await ctx.db.insert("semanticSearchIndex", {
        organizationId: args.organizationId,
        configId: args.configId,
        ...update,
      });
    }
  },
});
