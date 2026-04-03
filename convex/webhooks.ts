import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * handleClerkUserEvent
 * 
 * Synchronizes a Clerk user or organization into Convex.
 * This is an INTERNAL mutation intended to be called by our Next.js webhook route.
 */
export const syncUser = mutation({
  args: {
    tokenIdentifier: v.string(), // Clerk 'sub' ID
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    type: v.union(v.literal("user.created"), v.literal("user.updated"), v.literal("user.deleted")),
  },
  handler: async (ctx, args) => {
    const { tokenIdentifier, email, name, avatarUrl, type } = args;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (type === "user.deleted") {
      if (existingUser) {
        await ctx.db.delete(existingUser._id);
        // TODO: Clean up memberships if needed
      }
      return;
    }

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        name: name || existingUser.name,
        email: email || existingUser.email,
        avatarUrl: avatarUrl || existingUser.avatarUrl,
        lastSeenAt: Date.now(),
      });
      return existingUser._id;
    } else {
      return await ctx.db.insert("users", {
        tokenIdentifier,
        name: name || "Anonymous",
        email: email || "",
        avatarUrl,
        role: "member",
        createdAt: Date.now(),
      });
    }
  },
});

export const syncOrganization = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    clerkOrgId: v.string(), // We may want to store Clerk's own ID too
    type: v.union(v.literal("organization.created"), v.literal("organization.updated"), v.literal("organization.deleted")),
  },
  handler: async (ctx, args) => {
    const { slug, name, clerkOrgId, type } = args;

    // We assume the slug is unique across organizations
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();

    if (type === "organization.deleted") {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { name });
      return existing._id;
    } else {
      // For webhooks, we may not have an 'owner' immediately
      // but we should probably handle that in the membership webhook
      return await ctx.db.insert("organizations", {
        name,
        slug,
        plan: "free",
        // ownerId: ... // Handle via membership event
        createdAt: Date.now(),
      });
    }
  },
});
