import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Users ────────────────────────────────────────────────
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),          // bcrypt hash stored server-side
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    emailVerified: v.boolean(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),          // epoch ms
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_email", ["email"]),

  // ─── Sessions ─────────────────────────────────────────────
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),              // opaque session token (UUID)
    expiresAt: v.number(),              // epoch ms
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // ─── Organizations (multi-tenant) ─────────────────────────
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),             // URL-safe unique identifier
    logoUrl: v.optional(v.string()),
    plan: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("enterprise")
    ),
    ownerId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  // ─── Organization Memberships ──────────────────────────────
  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member")
    ),
    joinedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["organizationId", "userId"]),

  // ─── Invitations ──────────────────────────────────────────
  invitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    token: v.string(),          // unique invite token
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_org", ["organizationId"])
    .index("by_email", ["email"]),

  // ─── Password Reset Tokens ────────────────────────────────
  passwordResets: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // ─── Legacy messages (keep existing) ──────────────────────
  messages: defineTable({
    body: v.string(),
    author: v.string(),
  })
    .searchIndex("search_body", { searchField: "body" })
    .index("author", ["author"]),
});
