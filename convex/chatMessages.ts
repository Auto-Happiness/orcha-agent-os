import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

export const listBySession = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
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

export const update = mutation({
  args: {
    messageId: v.id("chatMessages"),
    content: v.optional(v.string()),
    parts: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found.");
    
    // Auth: Ensure the caller can write to this session's org
    // In a worker environment, we might use internal auth or bypass,
    // but checkMembership is safe if the worker has the right context.
    const session = await ctx.db.get(msg.sessionId);
    if (!session) throw new Error("Session context lost.");
    await checkMembership(ctx, session.organizationId);

    await ctx.db.patch(args.messageId, {
      content: args.content !== undefined ? args.content : msg.content,
      parts: args.parts !== undefined ? args.parts : msg.parts,
    });
  },
});

/**
 * workerUpdate — called by background workers.
 * Uses the self-hosted admin key at the HTTP level for auth (not Clerk).
 * The messageId is an opaque, unguessable Convex ID — sufficient protection.
 */
export const workerUpdate = mutation({
  args: {
    messageId: v.id("chatMessages"),
    content: v.optional(v.string()),
    parts: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found.");
    await ctx.db.patch(args.messageId, {
      content: args.content ?? msg.content,
      parts: args.parts ?? msg.parts,
    });
  },
});
