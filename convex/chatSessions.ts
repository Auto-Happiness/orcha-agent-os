import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkMembership } from "./authUtils";

export const listByOrganizationAndUser = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id)
      )
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    await checkMembership(ctx, session.organizationId);
    return session;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.optional(v.string()),
    configId: v.optional(v.id("databaseConfigs")),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found.");
    return await ctx.db.insert("chatSessions", {
      organizationId: args.organizationId,
      userId: user._id,
      title: args.title ?? "New Chat",
      configId: args.configId,
      modelId: args.modelId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateTitle = mutation({
  args: { sessionId: v.id("chatSessions"), title: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    await checkMembership(ctx, session.organizationId);
    await ctx.db.patch(args.sessionId, { title: args.title, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    await checkMembership(ctx, session.organizationId);
    // Delete all messages in the session
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of msgs) await ctx.db.delete(msg._id);
    await ctx.db.delete(args.sessionId);
  },
});

export const updateConfig = mutation({
  args: { 
    sessionId: v.id("chatSessions"), 
    configId: v.optional(v.id("databaseConfigs")),
    modelId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    await checkMembership(ctx, session.organizationId);
    
    const updates: any = { updatedAt: Date.now() };
    if (args.configId !== undefined) updates.configId = args.configId;
    if (args.modelId !== undefined) updates.modelId = args.modelId;
    
    await ctx.db.patch(args.sessionId, updates);
  },
});
