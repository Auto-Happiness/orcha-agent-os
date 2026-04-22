import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByConfig = query({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("savedQueries")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { queryId: v.id("savedQueries") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.queryId);
  },
});

export const save = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    name: v.string(),
    sql: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("savedQueries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateLastExecuted = mutation({
  args: { queryId: v.id("savedQueries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queryId, { lastExecutedAt: Date.now() });
  },
});

export const rename = mutation({
  args: { queryId: v.id("savedQueries"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queryId, { name: args.name });
  },
});

export const remove = mutation({
  args: { queryId: v.id("savedQueries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.queryId);
  },
});
