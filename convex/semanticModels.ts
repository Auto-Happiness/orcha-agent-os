import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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
    // 1. First, check if organization exists and user has access (TODO: full RBAC)
    
    const now = Date.now();

    for (const table of args.tables) {
      // 2. See if existing semantic model exists for this table
      const existing = await ctx.db
        .query("semanticModels")
        .withIndex("by_config", (q) => q.eq("configId", args.configId))
        .filter((q) => q.eq(q.field("tableName"), table.name))
        .unique();

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
        // 3. Update existing model, preserving custom displayNames if they existed?
        // For the first "Bridge" scan, we'll just merge fields
        await ctx.db.patch(existing._id, {
          fields,
          updatedAt: now,
        });
      } else {
        // 4. Create new semantic model
        await ctx.db.insert("semanticModels", {
          organizationId: args.organizationId,
          configId: args.configId,
          tableName: table.name,
          displayName: table.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
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
  args: { configId: v.id("databaseConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();
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
    const created = [];

    for (const fk of args.foreignKeys) {
      const fromModel = tableToModel.get(fk.fromTable);
      const toModel = tableToModel.get(fk.toTable);

      if (!fromModel || !toModel) continue;

      // 2. Check for duplicates
      const existing = await ctx.db
        .query("semanticRelationships")
        .withIndex("by_config", (q) => q.eq("configId", args.configId))
        .filter((q) =>
          q.and(
            q.eq(q.field("fromModelId"), fromModel._id),
            q.eq(q.field("fromColumn"), fk.fromColumn),
            q.eq(q.field("toModelId"), toModel._id),
            q.eq(q.field("toColumn"), fk.toColumn)
          )
        )
        .unique();

      if (existing) continue;

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
    }

    return { success: true, created, count: created.length };
  },
});

/**
 * Fallback: suggests relationships based on naming conventions (_id suffix).
 * Used for databases without explicit FK constraints.
 */
export const suggestRelationships = mutation({
  args: { 
    organizationId: v.id("organizations"),
    configId: v.id("databaseConfigs") 
  },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("semanticModels")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    const suggestions = [];

    for (const model of models) {
      for (const field of model.fields) {
        // Look for fields ending in _id that aren't the Primary Key
        if (field.columnName.toLowerCase().endsWith("_id") && !field.isPrimary) {
          const prefix = field.columnName.toLowerCase().replace("_id", "");
          
          const target = models.find(m => 
            m.tableName.toLowerCase() === prefix || 
            m.tableName.toLowerCase() === prefix + "s" ||
            m.tableName.toLowerCase() === prefix + "es"
          );

          if (target && target._id !== model._id) {
            const targetPk = target.fields.find(f => f.isPrimary);
            
            if (targetPk) {
              const existing = await ctx.db
                .query("semanticRelationships")
                .withIndex("by_from", (q) => q.eq("fromModelId", target._id))
                .filter((q) => q.eq(q.field("toModelId"), model._id))
                .unique();

              if (!existing) {
                const relId = await ctx.db.insert("semanticRelationships", {
                  organizationId: args.organizationId,
                  configId: args.configId,
                  name: `${target.tableName}_to_${model.tableName}`,
                  fromModelId: target._id,
                  fromColumn: targetPk.columnName,
                  toModelId: model._id,
                  toColumn: field.columnName,
                  type: "one_to_many",
                  createdAt: Date.now(),
                });
                suggestions.push({ id: relId, name: `${target.tableName} -> ${model.tableName}` });
              }
            }
          }
        }
      }
    }

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
  handler: async (ctx, args) => {
    // 1. Fetch the raw models
    const models = await ctx.runQuery(api.semanticModels.listModelsByConfig, { configId: args.configId });
    
    if (!models || models.length === 0) return { success: false, error: "No models found" };

    const promptContext = args.businessContext || "A database that needs semantic organization.";

    // 2. Prepare the prompt (conceptually using the businessContext)
    for (const model of models) {
      // In a real LLM call, we'd say: "Given the context: ${promptContext}, name this table ${model.tableName}"
      const enrichedFields = model.fields.map(f => {
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
