import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * listAll
 * 
 * Lists all MCP tools registered.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("mcpTools").collect();
  },
});

/**
 * listToolsByOrganization
 * 
 * Lists all MCP tools registered for a given organization.
 */
export const listByOrganization = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    if (!args.organizationId) {
      return await ctx.db.query("mcpTools").collect();
    }
    return await ctx.db
      .query("mcpTools")
      .withIndex("by_org", (q: any) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

/**
 * createTool
 * 
 * Registers a new MCP tool for the specified organization.
 */
export const create = mutation({
  args: {
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
    statement: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", userId))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("mcpTools", {
      ...args,
      createdAt: Date.now(),
      createdBy: user._id,
    });
  },
});
