import { mutation, query, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { checkMembership } from "./authUtils";

/**
 * Mutation to save (create or update) a semantic instruction.
 */
export const save = mutation({
  args: {
    id: v.optional(v.id("semanticInstructions")),
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);

    const now = Date.now();
    let instructionId;

    if (args.id) {
      // Update existing
      await ctx.db.patch(args.id, {
        title: args.title,
        content: args.content,
        createdAt: now,
      });
      instructionId = args.id;
    } else {
      // Insert new
      instructionId = await ctx.db.insert("semanticInstructions", {
        organizationId: args.organizationId,
        configId: args.configId,
        title: args.title,
        content: args.content,
        createdAt: now,
      });
    }

    // Schedule background embedding generation
    const config = await ctx.db.get(args.configId);
    const provider = config?.memoryProvider || "local";

    await ctx.scheduler.runAfter(0, internal.semanticInstructions.generateInstructionEmbedding, {
      organizationId: args.organizationId,
      instructionId,
      text: `Instruction: ${args.title}. Detail: ${args.content}`,
      provider: provider as any,
    });

    return { success: true, instructionId };
  },
});

/**
 * Mutation to remove a semantic instruction.
 */
export const remove = mutation({
  args: {
    id: v.id("semanticInstructions"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Mutation to remove multiple semantic instructions in bulk.
 */
export const removeBulk = mutation({
  args: {
    ids: v.array(v.id("semanticInstructions")),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    await Promise.all(args.ids.map((id) => ctx.db.delete(id)));
    return { success: true };
  },
});

/**
 * Mutation to create multiple semantic instructions in bulk.
 */
export const bulkSave = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    instructions: v.array(
      v.object({
        title: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);

    const config = await ctx.db.get(args.configId);
    const provider = config?.memoryProvider || "local";
    const now = Date.now();
    const results = [];

    await Promise.all(
      args.instructions.map(async (inst) => {
        const instructionId = await ctx.db.insert("semanticInstructions", {
          organizationId: args.organizationId,
          configId: args.configId,
          title: inst.title,
          content: inst.content,
          createdAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.semanticInstructions.generateInstructionEmbedding, {
          organizationId: args.organizationId,
          instructionId,
          text: `Instruction: ${inst.title}. Detail: ${inst.content}`,
          provider: provider as any,
        });

        results.push(instructionId);
      })
    );

    return { success: true, count: results.length };
  },
});

/**
 * Query to list all semantic instructions for a config.
 */
export const listByConfig = query({
  args: {
    configId: v.id("databaseConfigs"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) return [];

    await checkMembership(ctx, config.organizationId);

    return await ctx.db
      .query("semanticInstructions")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .order("desc")
      .collect();
  },
});

/**
 * Internal mutation to update embedding fields.
 */
export const internalUpdateInstructionEmbedding = internalMutation({
  args: {
    id: v.id("semanticInstructions"),
    embedding: v.array(v.float64()),
    dimensions: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const update: any = {};
    if (args.dimensions === 384) update.embedding_384 = args.embedding;
    else if (args.dimensions === 768) update.embedding_768 = args.embedding;
    else if (args.dimensions === 1024) update.embedding_1024 = args.embedding;
    else if (args.dimensions === 1536) update.embedding_1536 = args.embedding;
    else {
      console.warn(`[SemanticInstructions] Unsupported embedding dimensions: ${args.dimensions}`);
      return;
    }
    await ctx.db.patch(args.id, update);
  },
});

/**
 * Internal action to generate embedding.
 */
export const generateInstructionEmbedding = internalAction({
  args: {
    organizationId: v.id("organizations"),
    instructionId: v.id("semanticInstructions"),
    text: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("openai"), v.literal("local")),
  },
  handler: async (ctx, args) => {
    const trimmed = args.text.trim();
    if (!trimmed) return;

    console.log(`[SemanticInstructions] Generating embedding for instruction ${args.instructionId} via ${args.provider}`);
    try {
      const { embedding, dimensions } = await ctx.runAction(internal.embeddings.internalGenerateEmbedding, {
        organizationId: args.organizationId,
        text: trimmed,
        provider: args.provider,
      });

      await ctx.runMutation(internal.semanticInstructions.internalUpdateInstructionEmbedding, {
        id: args.instructionId,
        embedding,
        dimensions,
      });
      console.log(`[SemanticInstructions] Embedding successfully indexed for instruction ${args.instructionId}`);
    } catch (err: any) {
      console.error(`[SemanticInstructions] Failed to generate embedding for instruction ${args.instructionId}: ${err.message}`);
    }
  },
});

/**
 * Action to search instructions using vector search.
 */
export const searchInstructions = action({
  args: {
    configId: v.id("databaseConfigs"),
    embedding: v.array(v.float64()),
    indexName: v.union(
      v.literal("by_embedding_384"),
      v.literal("by_embedding_768"),
      v.literal("by_embedding_1024"),
      v.literal("by_embedding_1536")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{ title: string; content: string }>> => {
    const config = await ctx.runQuery(internal.databaseConfigs.internalGetById, {
      configId: args.configId,
    });
    if (!config) throw new Error("Config not found.");

    try {
      const searchResults = await ctx.vectorSearch("semanticInstructions", args.indexName, {
        vector: args.embedding,
        filter: (q) => q.eq("configId", args.configId),
        limit: args.limit || 3,
      });

      if (searchResults.length === 0) {
        return [];
      }

      return await ctx.runQuery(internal.semanticInstructions.resolveInstructionDetails, {
        instructionIds: searchResults.map((r) => r._id),
      });
    } catch (err: any) {
      if (err.message?.includes("bootstrapping")) {
        console.warn("[SemanticInstructions] Search index is bootstrapping, returning empty results.");
        return [];
      }
      console.error("[SemanticInstructions] Search failed:", err);
      return [];
    }
  },
});

/**
 * Internal query to resolve raw instruction details from IDs.
 */
export const resolveInstructionDetails = internalQuery({
  args: { instructionIds: v.array(v.id("semanticInstructions")) },
  handler: async (ctx, args) => {
    const list = [];
    for (const id of args.instructionIds) {
      const doc = await ctx.db.get(id);
      if (doc) {
        list.push({
          title: doc.title,
          content: doc.content,
        });
      }
    }
    return list;
  },
});
