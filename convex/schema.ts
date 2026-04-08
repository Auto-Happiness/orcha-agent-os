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
    clerkId: v.optional(v.string()), // Clerk's 'org_123...' identifier
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ownerId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_clerk_id", ["clerkId"]),

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
    name: v.string(),        // Environment Profile Name
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    modelProvider: v.optional(v.string()),
    modelConfig: v.optional(v.string()), // Encrypted LLM JSON
    businessContext: v.optional(v.string()), // Added for AI semantic memory
    status: v.optional(v.union(v.literal("draft"), v.literal("ready"))),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_org", ["organizationId"])
    .index("by_status", ["status"]),

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
  // ─── Bridge: MCP Tool Definitions ────────────────────────
  mcpTools: defineTable({
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    name: v.string(),
    description: v.string(),
    parameters: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        description: v.string(),
      })
    ),
    statement: v.string(), // SQL statement with placeholders
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_org", ["organizationId"])
    .index("by_config", ["configId"])
    .index("by_name", ["name"]),

  // ─── Wren AI: Semantic Layer Models ─────────────────────
  semanticModels: defineTable({
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    tableName: v.string(),     // Physical table name (e.g. 'users_raw')
    displayName: v.string(),   // Business name (e.g. 'Customers')
    description: v.optional(v.string()),
    fields: v.array(v.object({
      columnName: v.string(),  // Physical column name
      displayName: v.string(), // Business name (e.g. 'Revenue')
      description: v.optional(v.string()),
      type: v.string(),        // 'dimension' or 'measure'
      aggregation: v.optional(v.string()), // 'sum', 'avg', etc.
      expression: v.optional(v.string()),  // e.g. 'price * quantity'
      isPrimary: v.optional(v.boolean()),
      isHidden: v.optional(v.boolean()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_config", ["configId"]),

  // ─── Wren AI: Semantic Relationships (JOINs) ───────────
  semanticRelationships: defineTable({
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    name: v.string(), // e.g. "orders_to_customers"
    fromModelId: v.id("semanticModels"),
    fromColumn: v.string(),
    toModelId: v.id("semanticModels"),
    toColumn: v.string(),
    type: v.union(v.literal("one_to_one"), v.literal("one_to_many"), v.literal("many_to_one")),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_config", ["configId"])
    .index("by_from", ["fromModelId"])
    .index("by_to", ["toModelId"]),

  // ─── Bridge: Saved Data Lab Queries ──────────────────────
  savedQueries: defineTable({
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    name: v.string(),
    sql: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastExecutedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_config", ["configId"])
    .index("by_name", ["name"]),
  // ─── AI: Provider Configurations (API Keys) ──────────────
  aiKeys: defineTable({
    organizationId: v.id("organizations"),
    provider: v.union(
      v.literal("gemini"),
      v.literal("openai"),
      v.literal("claude"),
      v.literal("local"),
      v.literal("grok")
    ),
    keyType: v.string(),
    keyValue: v.string(),
    storageStrategy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_provider", ["organizationId", "provider"]),

  // ─── Chat Sessions ────────────────────────────────────────
  chatSessions: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    title: v.string(),
    configId: v.optional(v.id("databaseConfigs")),
    modelId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_user", ["organizationId", "userId"])
    .index("by_org", ["organizationId"]),

  // ─── Chat Messages ────────────────────────────────────────
  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    organizationId: v.optional(v.id("organizations")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    parts: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_org", ["organizationId"]),
});
