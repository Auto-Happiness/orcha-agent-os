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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
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
    type: v.union(v.literal("bar"), v.literal("line"), v.literal("pie"), v.literal("kpi")),
    title: v.string(),
    queryId: v.optional(v.id("savedQueries")),
    mapping: v.optional(v.object({
      labelKey: v.string(),
      valueKey: v.string(),
      color: v.optional(v.string()),
      aggregation: v.optional(v.string()),
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
      return await ctx.db.insert("dashboardWidgets", data);
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
