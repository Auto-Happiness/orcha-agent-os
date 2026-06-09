import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

/**
 * Save or update the MDL manifest for a given database configuration.
 */
export const save = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    catalog: v.string(),
    schema: v.string(),
    models: v.array(v.any()),
    relationships: v.array(v.any()),
    views: v.array(v.any()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate authorization (user membership or API key)
    await checkMembership(ctx, args.organizationId, args.apiKey);

    const existing = await ctx.db
      .query("mdlManifests")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        catalog: args.catalog,
        schema: args.schema,
        models: args.models,
        relationships: args.relationships,
        views: args.views,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("mdlManifests", {
        organizationId: args.organizationId,
        configId: args.configId,
        catalog: args.catalog,
        schema: args.schema,
        models: args.models,
        relationships: args.relationships,
        views: args.views,
        updatedAt: now,
      });
    }
  },
});

/**
 * Fetch the MDL manifest for a given database configuration.
 */
export const get = query({
  args: {
    configId: v.id("databaseConfigs"),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) return null;

    // Validate authorization
    if (args.apiKey) {
      await checkMembership(ctx, config.organizationId, args.apiKey);
    } else {
      await checkMembership(ctx, config.organizationId);
    }

    return await ctx.db
      .query("mdlManifests")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .unique();
  },
});

/**
 * Remove the MDL manifest for a given database configuration.
 */
export const remove = mutation({
  args: {
    configId: v.id("databaseConfigs"),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) return;

    await checkMembership(ctx, config.organizationId, args.apiKey);

    const existing = await ctx.db
      .query("mdlManifests")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal query to fetch a manifest by configId without auth checks (for background actions/workers).
 */
export const internalGetByConfig = internalQuery({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mdlManifests")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .unique();
  },
});

/**
 * Internal mutation to save a manifest without auth checks (called during background scanner jobs).
 */
export const internalSave = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    catalog: v.string(),
    schema: v.string(),
    models: v.array(v.any()),
    relationships: v.array(v.any()),
    views: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mdlManifests")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        catalog: args.catalog,
        schema: args.schema,
        models: args.models,
        relationships: args.relationships,
        views: args.views,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("mdlManifests", {
        organizationId: args.organizationId,
        configId: args.configId,
        catalog: args.catalog,
        schema: args.schema,
        models: args.models,
        relationships: args.relationships,
        views: args.views,
        updatedAt: now,
      });
    }
  },
});
