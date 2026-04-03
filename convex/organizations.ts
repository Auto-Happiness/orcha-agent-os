import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * getSafeBySlug
 * 
 * Returns the organization record for a given slug.
 * Safe to call from the client.
 */
export const getSafeBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .unique();
  },
});
