import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * syncMembership
 * 
 * JIT (Just-In-Time) membership creation.
 * If a user is logged in and verified via Clerk, we can ensure they are 
 * added to the Convex memberships table for the target organization.
 */
export const syncMembership = mutation({
  args: {
    organizationId: v.id("organizations"),
    role: v.optional(v.union(v.literal("owner"), v.literal("admin"), v.literal("member")))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Find our Convex user by full tokenIdentifier or subject
    let user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user && identity.subject) {
      user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
        .unique();
    }

    if (!user) {
      throw new Error("User record not found. Please sync user first.");
    }

    // Check if membership already exists
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", user._id)
      )
      .unique();

    if (existing) {
      return { success: true, message: "Already a member", membershipId: existing._id };
    }

    // Create the membership
    // NOTE: In a real production app, you might want to verify their Clerk role here
    // But for now, we'll allow JIT joining if they are authenticated
    const membershipId = await ctx.db.insert("memberships", {
      organizationId: args.organizationId,
      userId: user._id,
      role: args.role || "admin", // Default to admin for the JIT sync
      joinedAt: Date.now(),
    });

    // Also update the organization's ownerId if it's empty
    const org = await ctx.db.get(args.organizationId);
    if (org && !org.ownerId) {
      await ctx.db.patch(args.organizationId, { ownerId: user._id });
    }

    return { success: true, membershipId };
  },
});

/**
 * checkMembershipStatus
 * 
 * Fast query to verify if the current user has membership to the organization.
 */
export const checkMembershipStatus = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    // Find our Convex user
    let user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user && identity.subject) {
      user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
        .unique();
    }

    if (!user) return false;

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", user!._id)
      )
      .unique();

    if (existing) return true;

    // Direct owner check just in case
    const org = await ctx.db.get(args.organizationId);
    if (org && org.ownerId === user._id) return true;

    return false;
  }
});
