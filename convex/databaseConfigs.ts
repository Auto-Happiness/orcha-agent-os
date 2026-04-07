import { mutation, query } from "./_generated/server";
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

/**
 * createOrUpdate
 * 
 * Creates or updates the database configuration for an organization.
 */
export const createOrUpdate = mutation({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(v.literal("postgres"), v.literal("mysql"), v.literal("bigquery")),
    encryptedUri: v.string(), // In this demo, we're storing the JSON string (encryption TODO)
    updatedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("databaseConfigs")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        encryptedUri: args.encryptedUri,
        updatedBy: args.updatedBy,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("databaseConfigs", {
        organizationId: args.organizationId,
        type: args.type,
        encryptedUri: args.encryptedUri,
        name: `New ${args.type.charAt(0).toUpperCase() + args.type.slice(1)} Environment`,
        updatedBy: args.updatedBy,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * finalizeConfiguration
 * 
 * Finalizes the environment by saving profile metadata and AI model settings.
 */
export const finalizeConfiguration = mutation({
  args: {
    configId: v.id("databaseConfigs"),
    name: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    modelProvider: v.optional(v.string()),
    modelConfig: v.optional(v.string()),
    businessContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { configId, ...updates } = args;
    await ctx.db.patch(configId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
