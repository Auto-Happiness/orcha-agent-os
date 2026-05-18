import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * List all dashboards for an organization.
 */
export const listDashboards = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dashboards")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const getWidgetById = query({
  args: { widgetId: v.id("dashboardWidgets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.widgetId);
  },
});

/**
 * Get a specific dashboard and its widgets.
 */
export const getDashboard = query({
  args: { dashboardId: v.id("dashboards") },
  handler: async (ctx, args) => {
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) return null;

    const widgets = await ctx.db
      .query("dashboardWidgets")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    return { ...dashboard, widgets: widgets.sort((a, b) => a.order - b.order) };
  },
});

/**
 * Create a new dashboard.
 */
export const createDashboard = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throw new Error("User not found");

    return await ctx.db.insert("dashboards", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      isDefault: false,
      createdAt: Date.now(),
      createdBy: user._id,
    });
  },
});

/**
 * Update or Create a Widget (Upsert logic for the Intelligence Panel).
 */
export const saveWidget = mutation({
  args: {
    widgetId: v.optional(v.id("dashboardWidgets")),
    dashboardId: v.id("dashboards"),
    organizationId: v.id("organizations"),
    type: v.union(v.literal("bar"), v.literal("line"), v.literal("pie"), v.literal("kpi"), v.literal("text"), v.literal("table"), v.literal("counter")),
    title: v.string(),
    description: v.optional(v.string()),
    queryId: v.optional(v.id("savedQueries")),
    mapping: v.optional(v.object({
      labelKey: v.string(),
      valueKeys: v.array(v.string()),
      color: v.optional(v.string()),
      palette: v.optional(v.array(v.string())),
      seriesColors: v.optional(v.record(v.string(), v.string())),
      aggregation: v.optional(v.string()),
    })),
    layout: v.optional(v.object({
      x: v.number(),
      y: v.number(),
      w: v.number(),
      h: v.number(),
    })),
    order: v.number(),
    size: v.union(v.literal("small"), v.literal("medium"), v.literal("large"), v.literal("full")),
  },
  handler: async (ctx, args) => {
    const { widgetId, ...data } = args;

    if (widgetId) {
      await ctx.db.patch(widgetId, data);
      return widgetId;
    } else {
      return await ctx.db.insert("dashboardWidgets", {
        ...data,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Remove a widget.
 */
export const removeWidget = mutation({
  args: { widgetId: v.id("dashboardWidgets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.widgetId);
  },
});

/**
 * Delete a dashboard and all its widgets.
 */
export const deleteDashboard = mutation({
  args: { dashboardId: v.id("dashboards") },
  handler: async (ctx, args) => {
    // Delete all widgets associated with this dashboard
    const widgets = await ctx.db
      .query("dashboardWidgets")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    for (const widget of widgets) {
      await ctx.db.delete(widget._id);
    }

    // Delete the dashboard itself
    await ctx.db.delete(args.dashboardId);
  },
});

/**
 * Atomic mutation to create a full dashboard and all its widgets in a single transaction.
 */
export const createDashboardWithWidgets = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    name: v.string(),
    description: v.optional(v.string()),
    widgets: v.array(v.object({
      type: v.union(v.literal("bar"), v.literal("line"), v.literal("pie"), v.literal("kpi"), v.literal("text"), v.literal("table"), v.literal("counter")),
      title: v.string(),
      description: v.optional(v.string()),
      sql: v.string(),
      mapping: v.optional(v.object({
        labelKey: v.string(),
        valueKeys: v.array(v.string()),
        color: v.optional(v.string()),
        palette: v.optional(v.array(v.string())),
        seriesColors: v.optional(v.record(v.string(), v.string())),
        aggregation: v.optional(v.string()),
      })),
      layout: v.optional(v.object({
        x: v.number(),
        y: v.number(),
        w: v.number(),
        h: v.number(),
      })),
      order: v.number(),
      size: v.union(v.literal("small"), v.literal("medium"), v.literal("large"), v.literal("full")),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throw new Error("User not found");

    const dashboardId = await ctx.db.insert("dashboards", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      isDefault: false,
      createdAt: Date.now(),
      createdBy: user._id,
    });

    for (const w of args.widgets) {
      // 1. Save the SQL query to the savedQueries collection first
      const queryId = await ctx.db.insert("savedQueries", {
        organizationId: args.organizationId,
        configId: args.configId,
        name: `${args.name} - ${w.title}`,
        sql: w.sql,
        description: w.description || "AI-generated dashboard query",
        createdBy: user._id,
        createdAt: Date.now(),
        isFederated: true,
      });

      // 2. Save the widget and link it to the saved query ID
      await ctx.db.insert("dashboardWidgets", {
        dashboardId,
        organizationId: args.organizationId,
        type: w.type,
        title: w.title,
        description: w.description,
        queryId,
        mapping: w.mapping,
        layout: w.layout,
        order: w.order,
        size: w.size,
        createdAt: Date.now(),
      });
    }

    return dashboardId;
  },
});

/**
 * Creates a new dashboard generation proposal (Pending state).
 */
export const createProposal = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dashboardProposals", {
      organizationId: args.organizationId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/**
 * Updates the proposal with generated widgets or error state (Internal only).
 */
export const updateProposal = mutation({
  args: {
    proposalId: v.id("dashboardProposals"),
    status: v.union(v.literal("ready"), v.literal("failed")),
    error: v.optional(v.string()),
    widgets: v.optional(v.array(v.object({
      type: v.union(v.literal("bar"), v.literal("line"), v.literal("pie"), v.literal("kpi"), v.literal("text"), v.literal("table"), v.literal("counter")),
      title: v.string(),
      reason: v.optional(v.string()),
      sql: v.string(),
      mapping: v.optional(v.object({
        labelKey: v.string(),
        valueKeys: v.array(v.string()),
        color: v.optional(v.string()),
        palette: v.optional(v.array(v.string())),
        seriesColors: v.optional(v.record(v.string(), v.string())),
        aggregation: v.optional(v.string()),
      })),
    }))),
  },
  handler: async (ctx, args) => {
    const { proposalId, ...data } = args;
    await ctx.db.patch(proposalId, data);
  },
});

/**
 * Get a specific proposal (for real-time reactive UI polling).
 */
export const getProposal = query({
  args: { proposalId: v.id("dashboardProposals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.proposalId);
  },
});

// ─── Dashboard Query Cache (L2 Persistent Cache) ─────────────────────────────

/**
 * Retrieve a cached dashboard query result by its SHA-256 cache key.
 * Returns null if the entry does not exist or has expired.
 */
export const getDashboardCache = query({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("dashboardQueryCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();

    if (!entry) return null;
    if (entry.expiresAt < Date.now()) return null; // Stale entry

    return entry.data;
  },
});

/**
 * Persist a dashboard query result into the L2 cache.
 * Upserts the entry using the cacheKey, with a 5-minute TTL.
 */
export const setDashboardCache = mutation({
  args: {
    cacheKey: v.string(),
    organizationId: v.id("organizations"),
    data: v.string(),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ttl = args.ttlMs ?? 5 * 60 * 1000; // Default: 5 minutes
    const expiresAt = Date.now() + ttl;

    // Upsert: delete old entry if present, then insert new one
    const existing = await ctx.db
      .query("dashboardQueryCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data, expiresAt });
    } else {
      await ctx.db.insert("dashboardQueryCache", {
        cacheKey: args.cacheKey,
        organizationId: args.organizationId,
        data: args.data,
        expiresAt,
      });
    }
  },
});

/**
 * Sweep expired cache entries for an organization.
 * Call this periodically (e.g. on each dashboard load) to keep the table lean.
 */
export const sweepDashboardCache = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const staleEntries = await ctx.db
      .query("dashboardQueryCache")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    let swept = 0;
    for (const entry of staleEntries) {
      if (entry.expiresAt < now) {
        await ctx.db.delete(entry._id);
        swept++;
      }
    }
    if (swept > 0) console.log(`[CacheGC] Swept ${swept} stale cache entries for org ${args.organizationId}`);
  },
});

