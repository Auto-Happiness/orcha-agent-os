import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { checkMembership } from "./authUtils";

export const saveResult = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.optional(v.id("databaseConfigs")),
    name: v.string(),
    question: v.string(),
    sql: v.string(),
    resultColumns: v.array(v.string()),
    resultRows: v.string(), // JSON string representing the rows
    chatHistory: v.optional(v.string()), // Stringified JSON array of chat messages
    createdBy: v.id("users"),
    filterDateColumn: v.optional(v.string()),
    filterDateFrom: v.optional(v.string()),
    filterDateTo: v.optional(v.string()),
    filterRules: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate membership
    await checkMembership(ctx, args.organizationId);

    return await ctx.db.insert("databook", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listByOrg = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Validate membership
    const membership = await checkMembership(ctx, args.organizationId);
    if (!membership) return [];

    return await ctx.db
      .query("databook")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: {
    id: v.id("databook"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) return null;
    await checkMembership(ctx, entry.organizationId);
    return entry;
  },
});

export const rename = mutation({
  args: {
    id: v.id("databook"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Databook entry not found");
    await checkMembership(ctx, entry.organizationId);

    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: {
    id: v.id("databook"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Databook entry not found");
    await checkMembership(ctx, entry.organizationId);

    await ctx.db.delete(args.id);
  },
});

export const updateResultData = mutation({
  args: {
    id: v.id("databook"),
    resultColumns: v.array(v.string()),
    resultRows: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Databook entry not found");
    await checkMembership(ctx, entry.organizationId);

    await ctx.db.patch(args.id, {
      resultColumns: args.resultColumns,
      resultRows: args.resultRows,
    });
  },
});

export const saveDateFilter = mutation({
  args: {
    id: v.id("databook"),
    filterDateColumn: v.optional(v.string()),
    filterDateFrom: v.optional(v.string()),
    filterDateTo: v.optional(v.string()),
    filterRules: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Databook entry not found");
    await checkMembership(ctx, entry.organizationId);

    await ctx.db.patch(args.id, {
      filterDateColumn: args.filterDateColumn,
      filterDateFrom: args.filterDateFrom,
      filterDateTo: args.filterDateTo,
      filterRules: args.filterRules,
    });
  },
});
