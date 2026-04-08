import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

export const listBySession = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated.");
    const session = await ctx.db.get(args.sessionId);
    if (!session) return [];
    // Verify caller belongs to the session's org (single membership check)
    await checkMembership(ctx, session.organizationId);
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const append = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    organizationId: v.optional(v.id("organizations")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    parts: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    await checkMembership(ctx, session.organizationId);
    const id = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      organizationId: args.organizationId ?? session.organizationId,
      role: args.role,
      content: args.content,
      parts: args.parts,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
    return id;
  },
});

export const clearSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    await checkMembership(ctx, session.organizationId);
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of msgs) await ctx.db.delete(msg._id);
  },
});
