import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * seedAll
 * 
 * Safely creates a dummy owner user and a linked test organization
 * with the specific slug required for the current URL.
 */
export const seedAll = mutation({
  args: { 
    slug: v.string() 
  },
  handler: async (ctx, args) => {
    try {
      // 1. Create a fresh User
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: "system-test-" + Date.now(),
        name: "Test User",
        role: "owner",
        createdAt: Date.now(),
      });

      // 2. Create the organization
      await ctx.db.insert("organizations", {
        name: "Local Test Org",
        slug: args.slug,
        plan: "free",
        ownerId: userId,
        createdAt: Date.now(),
      });

      return "SUCCESS: User " + userId + " and Org created.";
    } catch (e: any) {
      return "FAILED: " + e.message;
    }
  },
});
