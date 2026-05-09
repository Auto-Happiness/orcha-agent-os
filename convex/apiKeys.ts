import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkMembership } from "./authUtils";
import { Id } from "./_generated/dataModel";

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    
    // Generate a simple API key (In production, use hashing)
    const key = `sk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    
    return await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      name: args.name,
      key,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Key not found");
    await checkMembership(ctx, existing.organizationId);
    await ctx.db.delete(args.id);
  },
});

export const validate = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
      
    if (!apiKey) return null;

    // Check if API is enabled for this org
    const settings = await ctx.db
        .query("developerSettings")
        .withIndex("by_org", (q) => q.eq("organizationId", apiKey.organizationId))
        .unique();
    
    if (settings && !settings.isPublicApiEnabled) return null;

    // Update last used (Note: In a high-traffic system, throttle this update)
    // For now, we just return the orgId
    return {
        organizationId: apiKey.organizationId,
        rateLimit: settings?.rateLimitPerMinute || 60
    };
  },
});

export const updateLastUsed = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (apiKey) {
      await ctx.db.patch(apiKey._id, { lastUsedAt: Date.now() });
    }
  },
});
