import { query } from "./_generated/server";
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
      .collect();
  },
});
