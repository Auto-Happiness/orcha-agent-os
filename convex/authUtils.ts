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

  // Find the user in our system. Subject (Clerk ID) is the most stable lookup.
  let user = null;
  if (identity.subject) {
    user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
  }

  // Fallback to full tokenIdentifier if subject lookup failed
  if (!user) {
    user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  }

  if (!user) {
    throw new Error("User not found in system.");
  }

  // Check if a membership exists for this user and organization (Highly indexed)
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => 
      q.eq("organizationId", organizationId).eq("userId", user!._id)
    )
    .unique();

  if (membership) {
    // If they are a member, we still might need the org record for the caller
    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error("Organization not found.");
    return { user, membership, organization: org };
  }

  // If not a member, check if they are the direct owner (Fallback)
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found.");
  }

  if (org.ownerId !== user._id) {
    throw new Error(`Access Denied: You are not a member of this organization.`);
  }

  return { user, membership: null, organization: org };
}

