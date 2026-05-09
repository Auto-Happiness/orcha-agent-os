import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkMembership } from "./authUtils";

export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const settings = await ctx.db
      .query("developerSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    
    if (!settings) {
      return {
        isPublicApiEnabled: true,
        rateLimitPerMinute: 60,
      };
    }
    return settings;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    isPublicApiEnabled: v.optional(v.boolean()),
    rateLimitPerMinute: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    
    const existing = await ctx.db
      .query("developerSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        isPublicApiEnabled: args.isPublicApiEnabled ?? existing.isPublicApiEnabled,
        rateLimitPerMinute: args.rateLimitPerMinute ?? existing.rateLimitPerMinute,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("developerSettings", {
        organizationId: args.organizationId,
        isPublicApiEnabled: args.isPublicApiEnabled ?? true,
        rateLimitPerMinute: args.rateLimitPerMinute ?? 60,
        updatedAt: Date.now(),
      });
    }
  },
});
