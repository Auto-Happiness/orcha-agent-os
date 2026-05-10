import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Helper to convert ArrayBuffer to hex string
 */
function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Helper to compute SHA-256 hash of a string
 */
async function hashKey(key: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}

/**
 * validates that the authenticated user belongs to the specified organization.
 * Throws an error if not authorized.
 * Now supports API Key authentication as an alternative to Clerk identity.
 */
export async function checkMembership(
  ctx: QueryCtx | MutationCtx, 
  organizationId: Id<"organizations">,
  apiKey?: string
) {
  // ── Handle API Key Auth ──
  if (apiKey) {
    const keyHash = await hashKey(apiKey);
    const keyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API Key.");
    }

    if (keyRecord.organizationId !== organizationId) {
      throw new Error("API Key does not belong to this organization.");
    }

    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error("Organization not found.");

    return { user: null, membership: null, organization: org };
  }

  // ── Handle Clerk Auth ──
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    // Instead of throwing, we return null to allow the caller to decide 
    // (e.g. queries returning empty results instead of crashing the UI)
    return null;
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

