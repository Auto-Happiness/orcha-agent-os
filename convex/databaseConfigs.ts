import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * getByOrganization
 * 
 * Returns the database configuration for a given organization slug.
 * Used by the Bridge to resolve credentials for JIT tool execution.
 */
export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("databaseConfigs")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .unique();
  },
});

/**
 * isConnected
 * 
 * Simple check if an organization has a database connected.
 */
export const isConnected = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("databaseConfigs")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .unique();
    return !!config;
  },
});
