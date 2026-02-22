import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

export const send = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  async handler(ctx, args) {
    const messageId = await ctx.db.insert("messages", {
      body: args.body,
      author: args.author,
    });
    return messageId;
  },
});
