import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * storeUser
 * 
 * Ensures the logged-in Clerk user exists in our local Convex table.
 * Returns the current user's Convex _id.
 */
export const storeUser = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication.");
    }

    // Check if we already have this user
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (user !== null) {
      // If we do, maybe update name or something
      if (user.name !== identity.name || user.email !== identity.email) {
        await ctx.db.patch(user._id, {
          name: identity.name,
          email: identity.email,
          avatarUrl: identity.pictureUrl,
          lastSeenAt: Date.now(),
        });
      }
      return user._id;
    }

    // If it's a new user, create it!
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name || args.name || "Anonymous",
      email: identity.email || args.email || "",
      avatarUrl: identity.pictureUrl || args.avatarUrl,
      role: "member", // Default role
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });

    return userId;
  },
});

/**
 * getCurrentUser
 * 
 * Returns the record for the currently logged-in user.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
  },
});
