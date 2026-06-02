import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

    // 1. Get authenticated user identity and sync user record JIT
    const identity = await ctx.auth.getUserIdentity();
    let userId: Id<"users"> | null = null;
    if (identity) {
      // Find user by tokenIdentifier or subject
      let user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .unique();

      if (!user && identity.subject) {
        user = await ctx.db
          .query("users")
          .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", identity.subject!))
          .unique();
      }

      if (!user) {
        userId = await ctx.db.insert("users", {
          tokenIdentifier: identity.tokenIdentifier,
          name: identity.name || "Anonymous",
          email: identity.email || "",
          avatarUrl: identity.pictureUrl,
          role: "member",
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
        });
      } else {
        userId = user._id;
      }
    }

    // 2. Primary lookup by Clerk ID (stable, never changes)
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkOrgId))
      .unique();

    let orgId: Id<"organizations">;
    if (existing) {
      // Update slug/name in case they changed in Clerk
      if (existing.slug !== slug || existing.name !== name) {
        await ctx.db.patch(existing._id, { name, slug });
      }
      orgId = existing._id;
    } else {
      // Not found — create it now (JIT sync)
      orgId = await ctx.db.insert("organizations", {
        clerkId: clerkOrgId,
        name,
        slug,
        plan: "free",
        createdAt: Date.now(),
        ownerId: userId || undefined,
      });
    }

    // 3. Sync Membership JIT if user is known
    if (userId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q: any) =>
          q.eq("organizationId", orgId).eq("userId", userId)
        )
        .unique();

      if (!membership) {
        await ctx.db.insert("memberships", {
          organizationId: orgId,
          userId,
          role: "admin",
          joinedAt: Date.now(),
        });
      }

      // Ensure org ownerId is set if it was missing (for existing orgs)
      const currentOrg = await ctx.db.get(orgId);
      if (currentOrg && !currentOrg.ownerId) {
        await ctx.db.patch(orgId, { ownerId: userId });
      }
    }

    return orgId;
  },
});
