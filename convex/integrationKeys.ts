import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

export const listByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    return await ctx.db
      .query("integrationKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const getByIntegration = query({
  args: { organizationId: v.id("organizations"), integration: v.string() },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    return await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_integration", (q) =>
        q.eq("organizationId", args.organizationId).eq("integration", args.integration)
      )
      .unique();
  },
});

/**
 * Internal version used by server-side actions (like OAuth callbacks)
 * which don't have a user context but are trusted.
 */
export const upsertKeyInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    integration: v.string(),
    qualifiedName: v.optional(v.string()),
    mcpUrl: v.optional(v.string()),
    keyType: v.string(),
    keyValue: v.string(),
    storageStrategy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_integration", (q) =>
        q.eq("organizationId", args.organizationId).eq("integration", args.integration)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        qualifiedName: args.qualifiedName,
        mcpUrl: args.mcpUrl,
        keyType: args.keyType,
        keyValue: args.keyValue,
        storageStrategy: args.storageStrategy,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("integrationKeys", {
      organizationId: args.organizationId,
      integration: args.integration,
      qualifiedName: args.qualifiedName,
      mcpUrl: args.mcpUrl,
      keyType: args.keyType,
      keyValue: args.keyValue,
      storageStrategy: args.storageStrategy,
      updatedAt: Date.now(),
    });
  },
});

export const upsertKey = mutation({
  args: {
    organizationId: v.id("organizations"),
    integration: v.string(),
    qualifiedName: v.optional(v.string()),
    mcpUrl: v.optional(v.string()),
    keyType: v.string(),
    keyValue: v.string(),
    storageStrategy: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    // Reuse logic via a direct call since we've already done auth check
    const existing = await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_integration", (q) =>
        q.eq("organizationId", args.organizationId).eq("integration", args.integration)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        qualifiedName: args.qualifiedName,
        mcpUrl: args.mcpUrl,
        keyType: args.keyType,
        keyValue: args.keyValue,
        storageStrategy: args.storageStrategy,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("integrationKeys", {
      organizationId: args.organizationId,
      integration: args.integration,
      qualifiedName: args.qualifiedName,
      mcpUrl: args.mcpUrl,
      keyType: args.keyType,
      keyValue: args.keyValue,
      storageStrategy: args.storageStrategy,
      updatedAt: Date.now(),
    });
  },
});

export const removeKey = mutation({
  args: { organizationId: v.id("organizations"), integration: v.string() },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const existing = await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_integration", (q) =>
        q.eq("organizationId", args.organizationId).eq("integration", args.integration)
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});
