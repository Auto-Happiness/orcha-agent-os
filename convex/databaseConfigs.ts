import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * listByOrganization
 * 
 * Returns only "ready" database configurations for a given organization.
 * Treats missing status as "ready" for backward compatibility.
 */
export const listByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("databaseConfigs")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .collect();
    
    // Filter manually to handle missing "status" field for old documents
    return all.filter((config: any) => config.status === "ready" || config.status === undefined);
  },
});

/**
 * getByOrganization
 * 
 * Returns the latest "ready" configuration.
 */
export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("databaseConfigs")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .collect();
      
    // Find the first matching "ready" or legacy document
    return all.find((config: any) => config.status === "ready" || config.status === undefined);
  },
});

/**
 * isConnected
 */
export const isConnected = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("databaseConfigs")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .collect();
    const config = all.find((config: any) => config.status === "ready" || config.status === undefined);
    return !!config;
  },
});

/**
 * createOrUpdate
 * 
 * Starts an environment setup. Sets status to "draft" by default.
 */
export const createOrUpdate = mutation({
  args: {
    configId: v.optional(v.id("databaseConfigs")),
    organizationId: v.id("organizations"),
    type: v.union(v.literal("postgres"), v.literal("mysql"), v.literal("bigquery"), v.literal("mssql"), v.literal("mongodb")),
    encryptedUri: v.string(), 
    updatedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    let existing: any = null;

    // 1. Try to find by ID if provided
    if (args.configId) {
      existing = await ctx.db.get(args.configId);
    }

    // 2. If no valid ID, try to find by organization + type
    if (!existing) {
      existing = await ctx.db
        .query("databaseConfigs")
        .withIndex("by_org_type", (q: any) => 
          q.eq("organizationId", args.organizationId).eq("type", args.type)
        )
        .first();
    }

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
        status: "draft", 
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
 * Promotes the environment from "draft" to "ready".
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
      status: "ready", 
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * remove
 */
export const remove = mutation({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    const relationships = await ctx.db
      .query("semanticRelationships")
      .withIndex("by_config", (q: any) => q.eq("configId", args.configId))
      .collect();
    for (const rel of relationships) {
      await ctx.db.delete(rel._id);
    }
    const models = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q: any) => q.eq("configId", args.configId))
      .collect();
    for (const model of models) {
      await ctx.db.delete(model._id);
    }
    await ctx.db.delete(args.configId);
    return { success: true };
  },
});
