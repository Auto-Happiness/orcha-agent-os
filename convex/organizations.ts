import { mutation, query } from "./_generated/server";
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
    // Try by slug first
    const bySlug = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .unique();
    if (bySlug) return bySlug;

    // Fallback: try by clerkId (in case org was created with ID as slug initially)
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", args.slug))
      .unique();
  },
});

/**
 * upsertFromClerk
 *
 * JIT (Just-In-Time) upsert called from the dashboard layout.
 * This ensures that an organization is always present in Convex
 * even if the Clerk webhook was missed or failed.
 * 
 * Uses the Clerk org ID as the primary lookup key for idempotency.
 */
export const upsertFromClerk = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const { clerkOrgId, name, slug } = args;

    // Primary lookup by Clerk ID (stable, never changes)
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkOrgId))
      .unique();

    if (existing) {
      // Update slug/name in case they changed in Clerk
      if (existing.slug !== slug || existing.name !== name) {
        await ctx.db.patch(existing._id, { name, slug });
      }
      return existing._id;
    }

    // Not found — create it now (JIT sync)
    return await ctx.db.insert("organizations", {
      clerkId: clerkOrgId,
      name,
      slug,
      plan: "free",
      createdAt: Date.now(),
    });
  },
});
