import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * validates that the authenticated user belongs to the specified organization.
 * Throws an error if not authorized.
 */
export async function checkMembership(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: Please log in.");
  }

  // Find the user in our system by their tokenIdentifier (the full Clerk issuer|subject)
  // Or by their subject (the Clerk user ID, which is what the webhook saves)
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
    throw new Error("User not found in system.");
  }

  // Fetch the organization to check for direct ownership
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found.");
  }

  // Check if a membership exists for this user and organization
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => 
      q.eq("organizationId", organizationId).eq("userId", user._id)
    )
    .unique();

  // If user is neither a member nor the direct owner, deny access
  if (!membership && org.ownerId !== user._id) {
    throw new Error(`Access Denied: You are not a member of this organization.`);
  }

  return { user, membership, organization: org };
}
