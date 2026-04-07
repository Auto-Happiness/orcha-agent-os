import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lists all relationships for a given database configuration.
 */
export const listByConfig = query({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("semanticRelationships")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();
  },
});
