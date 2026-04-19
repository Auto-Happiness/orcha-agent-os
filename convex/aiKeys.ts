import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

/**
 * listByOrganization
 */
export const listByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    return await ctx.db
      .query("aiKeys")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

/**
 * getByProvider
 */
export const getByProvider = query({
  args: { 
    organizationId: v.id("organizations"),
    provider: v.union(
      v.literal("gemini"),
      v.literal("openai"),
      v.literal("claude"),
      v.literal("local"),
      v.literal("grok")
    ),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    return await ctx.db
      .query("aiKeys")
      .withIndex("by_org_provider", (q: any) => 
        q.eq("organizationId", args.organizationId).eq("provider", args.provider)
      )
      .unique();
  },
});

/**
 * upsertKey
 */
export const upsertKey = mutation({
  args: {
    organizationId: v.id("organizations"),
    provider: v.union(
      v.literal("gemini"),
      v.literal("openai"),
      v.literal("claude"),
      v.literal("local"),
      v.literal("grok")
    ),
    keyType: v.string(),
    keyValue: v.string(),
    storageStrategy: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const existing = await ctx.db
      .query("aiKeys")
      .withIndex("by_org_provider", (q: any) => 
        q.eq("organizationId", args.organizationId).eq("provider", args.provider)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        keyValue: args.keyValue,
        storageStrategy: args.storageStrategy,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("aiKeys", {
        organizationId: args.organizationId,
        provider: args.provider,
        keyType: args.keyType,
        keyValue: args.keyValue,
        storageStrategy: args.storageStrategy,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * removeKey
 */
export const removeKey = mutation({
  args: { 
    organizationId: v.id("organizations"),
    provider: v.union(
      v.literal("gemini"),
      v.literal("openai"),
      v.literal("claude"),
      v.literal("local"),
      v.literal("grok")
    ),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const existing = await ctx.db
      .query("aiKeys")
      .withIndex("by_org_provider", (q: any) => 
        q.eq("organizationId", args.organizationId).eq("provider", args.provider)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true };
  },
});

/**
 * internalGetByProvider (bypasses auth for system actions)
 */
export const internalGetByProvider = internalQuery({
  args: { 
    organizationId: v.id("organizations"),
    provider: v.union(
      v.literal("gemini"),
      v.literal("openai"),
      v.literal("claude"),
      v.literal("local"),
      v.literal("grok")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiKeys")
      .withIndex("by_org_provider", (q: any) => 
        q.eq("organizationId", args.organizationId).eq("provider", args.provider)
      )
      .unique();
  },
});

/**
 * internalListByOrganization (bypasses auth)
 */
export const internalListByOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiKeys")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});
