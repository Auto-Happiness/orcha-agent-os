import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Users ────────────────────────────────────────────────
  // Updated for Clerk integration:
  // We identify users by their Clerk 'subject' (sub) in JWTs.
  users: defineTable({
    tokenIdentifier: v.string(), // Clerk 'sub' or other auth provider ID
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  // ─── Organizations (multi-tenant) ─────────────────────────
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ownerId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  // ─── Organization Memberships ──────────────────────────────
  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
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
    token: v.string(),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_org", ["organizationId"])
    .index("by_email", ["email"]),

  // ─── Legacy messages (keep existing) ──────────────────────
  messages: defineTable({
    body: v.string(),
    author: v.string(),
  })
    .searchIndex("search_body", { searchField: "body" })
    .index("author", ["author"]),

  // ─── Bridge: Multi-Tenant DB Configs ────────────────────
  databaseConfigs: defineTable({
    organizationId: v.id("organizations"),
    type: v.union(v.literal("postgres"), v.literal("mysql"), v.literal("bigquery")),
    encryptedUri: v.string(), // Encrypted DB URI
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_org", ["organizationId"]),

  // ─── Bridge: Large Scale Data Exports (10M+ ) ──────────
  dataExports: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    toolName: v.string(),
    args: v.any(),
    downloadUrl: v.optional(v.string()),
    rowCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_org", ["organizationId"]),
});
