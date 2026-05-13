import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

/**
 * Lists all relationships for a given database configuration.
 */
export const listByConfig = query({
  args: { configId: v.id("databaseConfigs"), apiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Config not found");
    const auth = await checkMembership(ctx, config.organizationId, args.apiKey);
    if (!auth) return [];

    return await ctx.db
      .query("semanticRelationships")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .take(500);
  },
});

/**
 * Internal query for background workers.
 */
export const internalListByConfig = internalQuery({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("semanticRelationships")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .take(500);
  },
});

/**
 * Internal mutation to create a relationship without full auth check.
 */
export const internalCreate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    name: v.string(),
    fromModelId: v.id("semanticModels"),
    fromColumn: v.string(),
    toModelId: v.id("semanticModels"),
    toColumn: v.string(),
    type: v.union(v.literal("one_to_one"), v.literal("one_to_many"), v.literal("many_to_one")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("semanticRelationships", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
/**
 * Internal mutation to create multiple relationships in a single transaction.
 * Optimized for large-scale schema discovery.
 */
export const internalCreateBatch = internalMutation({
  args: {
    relationships: v.array(v.object({
      organizationId: v.id("organizations"),
      configId: v.id("databaseConfigs"),
      name: v.string(),
      fromModelId: v.id("semanticModels"),
      fromColumn: v.string(),
      toModelId: v.id("semanticModels"),
      toColumn: v.string(),
      type: v.union(v.literal("one_to_one"), v.literal("one_to_many"), v.literal("many_to_one")),
    }))
  },
  handler: async (ctx, args) => {
    const ids = [];
    const now = Date.now();
    for (const rel of args.relationships) {
      const id = await ctx.db.insert("semanticRelationships", {
        ...rel,
        createdAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});
