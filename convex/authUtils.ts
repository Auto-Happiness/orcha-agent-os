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
    const [keyRecord, org] = await Promise.all([
      ctx.db.query("apiKeys").withIndex("by_hash", (q) => q.eq("keyHash", keyHash)).unique(),
      ctx.db.get(organizationId)
    ]);

    if (!keyRecord) throw new Error("Invalid API Key.");
    if (keyRecord.organizationId !== organizationId) throw new Error("API Key does not belong to this organization.");
    if (!org) throw new Error("Organization not found.");

    return { user: null, membership: null, organization: org };
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    const isMutation = typeof (ctx.db as any).insert === "function";
    if (isMutation) {
      throw new Error("Unauthenticated. Access Denied.");
    }
    return null;
  }

  // 1. Parallelize User (both formats) and Org lookups.
  // We run two user queries simultaneously to handle both storage formats:
  // - identity.subject       → short-form  (e.g. "user_abc123")
  // - identity.tokenIdentifier → long-form (e.g. "https://accounts.dev|user_abc123")
  // Existing users in the DB may be stored under either format.
  const [userBySubject, userByToken, org] = await Promise.all([
    identity.subject
      ? ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject!)).unique()
      : Promise.resolve(null),
    ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique(),
    ctx.db.get(organizationId)
  ]);

  const user = userBySubject ?? userByToken;

  if (!user) {
    const isMutation = typeof (ctx.db as any).insert === "function";
    if (isMutation) {
      throw new Error("User not found in system.");
    }
    return null;
  }
  
  if (!org) throw new Error("Organization not found.");

  // 2. Check Membership (Optimized Index)
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => 
      q.eq("organizationId", organizationId).eq("userId", user._id)
    )
    .unique();

  if (membership || org.ownerId === user._id) {
    return { user, membership, organization: org };
  }

  throw new Error(`Access Denied: You are not a member of ${org.name}`);
}

