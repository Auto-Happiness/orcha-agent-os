import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

export const listByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    return await ctx.db
      .query("spreadsheets")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { spreadsheetId: v.id("spreadsheets") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.spreadsheetId);
    if (!doc) return null;
    await checkMembership(ctx, doc.organizationId);
    return doc;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found.");
    return await ctx.db.insert("spreadsheets", {
      organizationId: args.organizationId,
      name: args.name,
      sheets: [{
        id: `sheet_${Date.now()}`,
        name: "Sheet1",
        order: 0,
        celldata: [],
        columnlen: {},
        rowlen: {},
        images: [],
      }],
      createdBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const save = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    name: v.string(),
    sheets: v.array(v.object({
      id: v.string(),
      name: v.string(),
      order: v.number(),
      celldata: v.array(v.object({ r: v.number(), c: v.number(), v: v.any() })),
      columnlen: v.optional(v.any()),
      rowlen: v.optional(v.any()),
      images: v.optional(v.array(v.object({
        id: v.string(), src: v.string(),
        left: v.number(), top: v.number(),
        width: v.number(), height: v.number(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.spreadsheetId);
    if (!doc) throw new Error("Spreadsheet not found.");
    await checkMembership(ctx, doc.organizationId);
    await ctx.db.patch(args.spreadsheetId, {
      name: args.name,
      sheets: args.sheets,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { spreadsheetId: v.id("spreadsheets"), name: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.spreadsheetId);
    if (!doc) throw new Error("Spreadsheet not found.");
    await checkMembership(ctx, doc.organizationId);
    await ctx.db.patch(args.spreadsheetId, { name: args.name, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { spreadsheetId: v.id("spreadsheets") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.spreadsheetId);
    if (!doc) throw new Error("Spreadsheet not found.");
    await checkMembership(ctx, doc.organizationId);
    await ctx.db.delete(args.spreadsheetId);
  },
});
