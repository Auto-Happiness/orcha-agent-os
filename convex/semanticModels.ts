import { mutation, query, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { checkMembership } from "./authUtils";

/**
 * Bulk updates or creates semantic models after a database scan.
 */
export const bulkUpdate = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    tables: v.array(
      v.object({
        name: v.string(),
        isView: v.optional(v.boolean()),
        columns: v.array(
          v.object({
            name: v.string(),
            dataType: v.string(),
            isPrimary: v.boolean(),
            isNullable: v.boolean(),
            defaultValue: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Fetch all existing models for this config once to avoid O(N^2) reads
    const existingModels = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    const tableNameToModel = new Map(existingModels.map((m) => [m.tableName, m]));

    for (const table of args.tables) {
      const existing = tableNameToModel.get(table.name);

      const fields = table.columns.map((col) => {
        // Map common column types to dimension/measure
        const isMeasure =
          col.dataType.includes("int") ||
          col.dataType.includes("decimal") ||
          col.dataType.includes("float") ||
          col.dataType.includes("double") ||
          col.dataType.includes("numeric");

        return {
          columnName: col.name,
          displayName: col.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: "",
          type: isMeasure ? "measure" : "dimension",
          aggregation: isMeasure ? "sum" : undefined,
          expression: undefined,
          isPrimary: col.isPrimary,
          isHidden: col.name.toLowerCase().includes("password") ||
            col.name.toLowerCase().includes("secret") ||
            col.name.toLowerCase().includes("token") ||
            col.name.toLowerCase().includes("hash") ||
            (col.name.toLowerCase().endsWith("_id") && !col.isPrimary),
        };
      });

      if (existing) {
        await ctx.db.patch(existing._id, {
          fields,
          isView: table.isView ?? false,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("semanticModels", {
          organizationId: args.organizationId,
          configId: args.configId,
          tableName: table.name,
          displayName: table.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          isView: table.isView ?? false,
          fields,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, count: args.tables.length };
  },
});

/**
 * Fetch all semantic models for an organization/config.
 */
export const listModelsByConfig = query({
  args: { configId: v.id("databaseConfigs"), apiKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<any[]> => {
    return await ctx.runQuery(internal.semanticModels.internalListModelsByConfig, args);
  },
});

export const internalListModelsByConfig = internalQuery({
  args: { configId: v.id("databaseConfigs"), apiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Config not found");
    // Only check membership if apiKey is provided (external call)
    if (args.apiKey) {
      const auth = await checkMembership(ctx, config.organizationId, args.apiKey);
      if (!auth) return [];
    }
    // Cap at 500 and strip heavy embeddings to avoid 1s Convex timeout.
    // Embeddings are only needed for the actual vector search action.
    const models = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .take(500);

    // Explicitly include fields while stripping heavy embeddings
    return models.map(({ fields, embedding_768, embedding_1024, embedding_1536, ...rest }: any) => ({
      ...rest,
      fields: fields || []
    }));
  },
});

export const listModelSummariesByConfig = query({
  args: { 
    configId: v.id("databaseConfigs"), 
    apiKey: v.optional(v.string()),
    paginationOpts: v.any() // paginationOpts comes from usePaginatedQuery
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runQuery(internal.semanticModels.internalListModelSummariesByConfig, args);
  },
});

export const internalListModelSummariesByConfig = internalQuery({
  args: { 
    configId: v.id("databaseConfigs"), 
    apiKey: v.optional(v.string()),
    paginationOpts: v.any()
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Config not found");

    if (args.apiKey) {
      const auth = await checkMembership(ctx, config.organizationId, args.apiKey);
      if (!auth) return { page: [], isDone: true, continueCursor: "" };
    }

    const paginated = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .paginate(args.paginationOpts);

    // Return everything EXCEPT 'fields' and embeddings
    return {
      ...paginated,
      page: paginated.page.map(({ fields, embedding_768, embedding_1024, embedding_1536, ...rest }: any) => ({
        ...rest,
        fieldCount: fields?.length || 0
      }))
    };
  },
});

/**
 * Fetch full details for a single model by tableName.
 */
export const getModelDetails = query({
  args: { configId: v.id("databaseConfigs"), tableName: v.string(), apiKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<any> => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Config not found");
    if (args.apiKey) {
      const auth = await checkMembership(ctx, config.organizationId, args.apiKey);
      if (!auth) return null;
    }

    const model = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .filter((q) => q.eq(q.field("tableName"), args.tableName))
      .first();

    if (!model) return null;

    // Return with fields but strip heavy embeddings
    const { embedding_768, embedding_1024, embedding_1536, ...rest } = model;
    return rest;
  },
});


/**
 * Update a specific semantic model's metadata (business names, types, etc.)
 */
export const updateModel = mutation({
  args: {
    id: v.id("semanticModels"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    fields: v.optional(
      v.array(
        v.object({
          columnName: v.string(),
          displayName: v.string(),
          description: v.optional(v.string()),
          type: v.string(),
          aggregation: v.optional(v.string()),
          expression: v.optional(v.string()),
          isPrimary: v.optional(v.boolean()),
          isHidden: v.optional(v.boolean()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Creates relationships from real database foreign key constraints.
 * This is the primary method — it uses actual FK metadata from the database.
 */
export const bulkCreateRelationships = mutation({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs"),
    foreignKeys: v.array(
      v.object({
        fromTable: v.string(),
        fromColumn: v.string(),
        toTable: v.string(),
        toColumn: v.string(),
        constraintName: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Fetch all models for this config to resolve table names → model IDs
    const models = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    const tableToModel = new Map(models.map(m => [m.tableName, m]));

    // 2. Fetch all existing relationships to avoid O(N*M) reads inside the loop
    const existingRels = await ctx.db
      .query("semanticRelationships")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    const relKeySet = new Set(
      existingRels.map(
        (r) => `${r.fromModelId}|${r.fromColumn}|${r.toModelId}|${r.toColumn}`
      )
    );

    const created = [];

    for (const fk of args.foreignKeys) {
      const fromModel = tableToModel.get(fk.fromTable);
      const toModel = tableToModel.get(fk.toTable);

      if (!fromModel || !toModel) continue;

      // Check for duplicates in memory
      const key = `${fromModel._id}|${fk.fromColumn}|${toModel._id}|${fk.toColumn}`;
      if (relKeySet.has(key)) continue;

      // 3. Insert new relationship
      const relId = await ctx.db.insert("semanticRelationships", {
        organizationId: args.organizationId,
        configId: args.configId,
        name: `${fk.fromTable}.${fk.fromColumn} → ${fk.toTable}.${fk.toColumn}`,
        fromModelId: fromModel._id,
        fromColumn: fk.fromColumn,
        toModelId: toModel._id,
        toColumn: fk.toColumn,
        type: "many_to_one",
        createdAt: Date.now(),
      });

      created.push({
        id: relId,
        name: `${fk.fromTable}.${fk.fromColumn} → ${fk.toTable}.${fk.toColumn}`,
      });

      // Add to set to prevent duplicates within the same batch if necessary
      relKeySet.add(key);
    }

    return { success: true, created, count: created.length };
  },
});

/**
 * Fallback: suggests relationships based on naming conventions (_id suffix).
 * Batched cleanup of embeddings. 
 * For large schemas (200+ tables), clearing all vectors in one transaction 
 * can hit the 1s Convex timeout. This action handles the cleanup in safe chunks.
 */
export const clearEmbeddingsForConfig = internalAction({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    // 1. Get all model IDs for this config
    const models = await ctx.runQuery(internal.semanticModels.listModelIdsByConfig, { configId: args.configId });

    if (models.length === 0) return;

    console.log(`[Embeddings] Starting batched cleanup for ${models.length} models...`);

    // 2. Process in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < models.length; i += chunkSize) {
      const chunk = models.slice(i, i + chunkSize);
      await ctx.runMutation(internal.semanticModels.batchClearEmbeddings, { modelIds: chunk });
      console.log(`[Embeddings] Cleared chunk ${Math.floor(i / chunkSize) + 1}`);
    }

    console.log(`[Embeddings] Batched cleanup COMPLETE for config ${args.configId}`);
  }
});

/**
 * Internal mutation to clear embeddings for a specific chunk of models.
 */
export const batchClearEmbeddings = internalMutation({
  args: { modelIds: v.array(v.id("semanticModels")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const modelId of args.modelIds) {
      await ctx.db.patch(modelId, {
        embedding_768: undefined,
        embedding_1024: undefined,
        embedding_1536: undefined,
        updatedAt: now,
      });
    }
  }
});

/**
 * Internal query to get all model IDs for a config.
 */
export const listModelIdsByConfig = internalQuery({
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();
    return models.map(m => m._id);
  }
});

/**
 * Fallback: suggests relationships based on naming conventions (_id suffix).
 * Used for databases without explicit FK constraints.
 */
/**
 * Suggests relationships based on naming conventions (_id suffix).
 * Refactored to an ACTION to prevent OCC conflicts during background indexing.
 */
export const suggestRelationships = action({
  args: {
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs")
  },
  handler: async (ctx, args): Promise<{ success: boolean; suggestions?: any[]; error?: string }> => {
    // 1. Fetch lightweight summaries first (this is fast)
    const summaries = await ctx.runQuery(internal.semanticModels.internalListModelSummariesByConfig, { configId: args.configId, paginationOpts: { numItems: 1000, cursor: null } });

    // 2. Fetch existing relationships (capped at 500)
    const existingRels = await ctx.runQuery(internal.semanticRelationships.internalListByConfig, { configId: args.configId });
    const relKeySet = new Set(existingRels.map((r: any) => `${r.fromModelId}|${r.toModelId}`));

    const suggestions = [];

    console.log(`[Relationships] Starting one-by-one discovery for ${summaries.page.length} tables...`);

    for (const summary of summaries.page) {
      // 3. Fetch full details (including fields) for JUST THIS ONE TABLE
      const model = await ctx.runQuery(internal.semanticModels.getById, { modelId: summary._id });
      if (!model || !model.fields) continue;

      for (const field of model.fields) {
        if (field.columnName.toLowerCase().endsWith("_id") && !field.isPrimary) {
          const prefix = field.columnName.toLowerCase().replace("_id", "");

          // 4. Look for a target table in our pre-fetched summaries
          const target = summaries.page.find((m: any) =>
            m.tableName.toLowerCase() === prefix ||
            m.tableName.toLowerCase() === prefix + "s" ||
            m.tableName.toLowerCase() === prefix + "es"
          );

          if (target && target._id !== model._id) {
            // Find target primary key (we might need full details for target too if not in summary)
            // But usually primary keys are standard. For safety, let's assume PK discovery logic.
            // Check if we already have this link
            if (!relKeySet.has(`${target._id}|${model._id}`)) {
              // Create the relationship
              const relId = await ctx.runMutation(internal.semanticRelationships.internalCreate, {
                organizationId: args.organizationId,
                configId: args.configId,
                name: `${target.tableName}_to_${model.tableName}`,
                fromModelId: target._id,
                fromColumn: "id", // Default to 'id' or we can fetch target details if needed
                toModelId: model._id,
                toColumn: field.columnName,
                type: "one_to_many",
              });

              suggestions.push({ id: relId, name: `${target.tableName} -> ${model.tableName}` });
              relKeySet.add(`${target._id}|${model._id}`);
            }
          }
        }
      }
    }

    console.log(`[Relationships] Discovery complete. Found ${suggestions.length} new links.`);
    return { success: true, suggestions };
  },
});

/**
 * AI-powered semantic enrichment.
 * In a real app, this would call OpenAI or Gemini.
 */
export const generateAiEnrichment = action({
  args: {
    configId: v.id("databaseConfigs"),
    businessContext: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // 1. Fetch the raw models
    const models = await ctx.runQuery(api.semanticModels.listModelsByConfig, { configId: args.configId });

    if (!models || models.length === 0) return { success: false, error: "No models found" };

    const promptContext = args.businessContext || "A database that needs semantic organization.";

    // 2. Prepare the prompt (conceptually using the businessContext)
    for (const model of models) {
      // In a real LLM call, we'd say: "Given the context: ${promptContext}, name this table ${model.tableName}"
      const enrichedFields = model.fields.map((f: any) => {
        const name = f.columnName.toLowerCase();

        // Simple "AI-like" heuristic for the demo
        let displayName = f.displayName;
        if (name === "id") displayName = `${model.tableName.slice(0, -1)} ID`;
        if (name.includes("price") || name.includes("amount") || name.includes("total")) {
          return { ...f, displayName: f.displayName + " ($)", type: "measure", aggregation: "sum" };
        }
        if (name.includes("date") || name.includes("at") || name.includes("time")) {
          return { ...f, type: "dimension" };
        }

        return { ...f, displayName };
      });

      await ctx.runMutation(api.semanticModels.updateModel, {
        id: model._id,
        fields: enrichedFields,
      });
    }

    return { success: true };
  },
});

/**
 * Vector search for relevant models based on an embedding.
 * NOTE: Vector search MUST be an action in Convex.
 */
export const searchRelatedModels = action({
  args: {
    configId: v.id("databaseConfigs"),
    embedding: v.array(v.float64()),
    indexName: v.union(
      v.literal("by_embedding_768"),
      v.literal("by_embedding_1024"),
      v.literal("by_embedding_1536")
    ),
    limit: v.optional(v.number()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    // Check membership via a query
    await ctx.runQuery(api.semanticModels.checkConfigAccess, {
      configId: args.configId,
      apiKey: args.apiKey
    });

    try {
      return await ctx.vectorSearch("semanticModels", args.indexName, {
        vector: args.embedding,
        filter: (q) => q.eq("configId", args.configId),
        limit: args.limit || 10,
      });
    } catch (err: any) {
      if (err.message?.includes("bootstrapping")) {
        console.warn("[VectorSearch] Index is bootstrapping, returning empty results.");
        return [];
      }
      throw err;
    }
  },
});

export const checkConfigAccess = query({
  args: { configId: v.id("databaseConfigs"), apiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Config not found");
    await checkMembership(ctx, config.organizationId, args.apiKey);
  },
});

export const getById = internalQuery({
  args: { modelId: v.id("semanticModels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.modelId);
  },
});

/**
 * Internal mutation to save the vector into the correct field based on dimensions.
 */
export const updateModelEmbedding = internalMutation({
  args: {
    id: v.id("semanticModels"),
    embedding: v.array(v.float64()),
    dimensions: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const update: any = { updatedAt: Date.now() };

    if (args.dimensions === 768) update.embedding_768 = args.embedding;
    else if (args.dimensions === 1024) update.embedding_1024 = args.embedding;
    else if (args.dimensions === 1536) update.embedding_1536 = args.embedding;
    else {
      console.warn(`[Embeddings] Unsupported dimension count: ${args.dimensions}`);
      return;
    }

    await ctx.db.patch(args.id, update);
  },
});
/**
 * Stage 2 of O(1) Semantic Retrieval:
 * Given a set of matched model IDs, this query resolves 1st-degree foreign key connections,
 * and fetches the full schemas (without embeddings) for all relevant tables.
 */
export const getRelatedModelsContext = internalQuery({
  args: { configId: v.id("databaseConfigs"), matchedIds: v.array(v.id("semanticModels")) },
  handler: async (ctx, args): Promise<{ models: any[], relationships: any[] }> => {
    const matchedSet = new Set(args.matchedIds);
    const requiredIds = new Set(args.matchedIds);

    // 1. Fetch all relationships for this config
    const relationships = await ctx.db
      .query("semanticRelationships")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    // 2. Resolve 1st-degree connections
    const relevantRelationships = [];
    for (const rel of relationships) {
      if (matchedSet.has(rel.fromModelId) || matchedSet.has(rel.toModelId)) {
        requiredIds.add(rel.fromModelId);
        requiredIds.add(rel.toModelId);
        relevantRelationships.push(rel);
      }
    }

    // 3. Fetch full schemas for the required tables
    const models = [];
    for (const modelId of requiredIds) {
      const model = await ctx.db.get(modelId);
      if (model) {
        // Strip heavy embeddings before returning to Edge function
        const { embedding_768, embedding_1024, embedding_1536, ...rest } = model;
        models.push(rest);
      }
    }

    return { models, relationships: relevantRelationships };
  },
});

/**
 * Stage 1 of O(1) Semantic Retrieval:
 * This action performs the vector search (top 10), then calls the internal query
 * to resolve foreign keys and fetch the clean schema.
 */
export const retrieveSchemaContext = action({
  args: {
    configId: v.id("databaseConfigs"),
    embedding: v.array(v.float64()),
    indexName: v.union(
      v.literal("by_embedding_768"),
      v.literal("by_embedding_1024"),
      v.literal("by_embedding_1536")
    ),
    limit: v.optional(v.number()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ models: any[], relationships: any[] }> => {
    // Check membership
    await ctx.runQuery(api.semanticModels.checkConfigAccess, {
      configId: args.configId,
      apiKey: args.apiKey
    });

    try {
      // 1. Vector Search
      const searchResults = await ctx.vectorSearch("semanticModels", args.indexName, {
        vector: args.embedding,
        filter: (q) => q.eq("configId", args.configId),
        limit: args.limit || 15,
      });

      if (searchResults.length === 0) {
        return { models: [], relationships: [] };
      }

      const matchedIds = searchResults.map((r) => r._id);

      // 2. Fetch dependencies and schemas via internal query
      const context = await ctx.runQuery(internal.semanticModels.getRelatedModelsContext, {
        configId: args.configId,
        matchedIds,
      });

      return context;

    } catch (err: any) {
      if (err.message?.includes("bootstrapping")) {
        console.warn("[VectorSearch] Index is bootstrapping, returning empty context.");
        return { models: [], relationships: [] };
      }
      throw err;
    }
  },
});
