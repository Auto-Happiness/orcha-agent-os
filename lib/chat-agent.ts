import { UIMessage, jsonSchema, ToolLoopAgent, stepCountIs, generateObject } from "ai";
import { z } from "zod";
import { resolveModel } from "./model-resolver";
import { pruneColumns, getPruningModelId } from "./column-pruner";
import { api } from "@/convex/_generated/api";
import { OrchaFusion } from "./engine/orcha-fusion";
import { getNativeDialectRule, getFederatedRule } from "./dialects";
import { buildManifest, validateSQL, CompiledManifest } from "./sql-validator";
import { rewriteConversationalQuery } from "./query-rewriter";
import { transpileSemanticSQL } from "./semantic-transpiler";
import { SkillsManager, SkillType } from "./skills-manager";
import { compileToMdl } from "./semantic-compiler";
import { classifyError, ErrorType } from "./errors";


const MAX_ROWS = 50;
const ALLOWED_SQL_PREFIXES = ["select", "show", "describe", "explain", "with"];

const intentSchema = z.object({
  intent: z.enum(["TEXT_TO_SQL", "SCHEMA_EXPLORATION", "CHART_GENERATION", "GENERAL_CHAT"]),
  reason: z.string(),
});

async function classifyIntent(
  query: string,
  model: any
): Promise<SkillType> {
  const lowercaseQuery = query.toLowerCase().trim();
  
  // Quick heuristic for greetings and basic capability questions to bypass LLM classification latency
  if (/^(hi|hello|hey|greetings|howdy|yo|good morning|good afternoon|good evening)(\s|$)/i.test(lowercaseQuery)) {
    return "GENERAL_CHAT";
  }
  if (/^(what can you do|who are you|help|capabilities|how do i use this)(\s|$|\?)/i.test(lowercaseQuery)) {
    return "GENERAL_CHAT";
  }
  
  try {
    const { object } = await generateObject({
      model,
      schema: intentSchema,
      system: `You are an intent classifier for a database assistant. Analyze the user's input and classify it into one of the following intents:
      - TEXT_TO_SQL: The user is asking a data question that requires querying the database (e.g. counting rows, filtering, comparing numbers, summing columns, top N, sales per month).
      - SCHEMA_EXPLORATION: The user is asking about the database structure, table definitions, columns, primary keys, or relationships (e.g. "what columns are in users?", "how is orders table joined?", "show me the schema", "list all tables").
      - CHART_GENERATION: The user explicitly wants a visual chart, graph, plot, or visualization of some database query (e.g. "plot sales", "draw a bar chart of monthly revenue", "visualize customer trends", "graph the number of orders").
      - GENERAL_CHAT: General greetings, asking about capabilities, how to use the assistant, general conversational talking, or anything unrelated to database structure or database queries.`,
      prompt: `User Input: "${query}"`,
    });
    return object.intent as SkillType;
  } catch (err) {
    console.warn("[IntentClassifier] Classification failed, defaulting to TEXT_TO_SQL:", err);
    return "TEXT_TO_SQL";
  }
}

function isSafeSQL(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  return ALLOWED_SQL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export interface AgentContext {
  convex: any;
  organizationId: string;
  configId?: string;
  configIds?: string[];
  modelId: string;
  showResults: boolean;
  messages: UIMessage[];
  userId: string;
  orgIdStr: string;
  apiKey?: string;
  defaultModelId?: string;
  defaultConfigId?: string;
}

async function selectTablesWithLLM(
  question: string,
  allModels: any[],
  model: any
): Promise<any[]> {
  console.log(`[Agent] Running LLM-based table selection for ${allModels.length} tables...`);
  try {
    const tableMetadata = allModels.map((m: any) => ({
      tableName: m.tableName,
      description: m.description || m.remarks || "No description provided."
    }));

    const response = await generateObject({
      model: model,
      schema: z.object({
        selectedTables: z.array(z.string().describe("The exact tableName of the table that is relevant to the question."))
      }),
      system: `You are a database expert. Your task is to analyze the user's natural language question and select the relevant database tables from the list that are needed to answer the question.
Select any tables that might contain the fields, categories, or relations needed to build the query.
Only return tables that actually exist in the provided list.`,
      prompt: `User Question: "${question}"\n\nAvailable Tables:\n${JSON.stringify(tableMetadata, null, 2)}`
    });

    const selectedNames = new Set((response.object.selectedTables || []).map(t => t.toLowerCase()));
    const matched = allModels.filter((m: any) => selectedNames.has(m.tableName.toLowerCase()));
    console.log(`[Agent] LLM selected ${matched.length} tables: ${matched.map(m => m.tableName).join(", ")}`);
    return matched;
  } catch (err) {
    console.error("[Agent] LLM-based table selection failed:", err);
    return [];
  }
}

export async function createChatAgent(context: AgentContext) {
  const { convex, organizationId, configId: rawConfigId, configIds: rawConfigIds, modelId, showResults, messages, userId, orgIdStr, apiKey, defaultModelId, defaultConfigId } = context;

  const activeConfigIds = rawConfigIds && rawConfigIds.length > 0
    ? rawConfigIds
    : (rawConfigId ? [rawConfigId] : (defaultConfigId ? [defaultConfigId] : []));

  const configId = activeConfigIds[0];

  // 1. Parallel fetch configurations, AI keys, integrations, and the MDL manifest document
  let [allConfigs, aiKeys, integrationKeys, manifest] = await Promise.all([
    convex.query(api.databaseConfigs.listByOrganization, { organizationId, apiKey }),
    convex.query(api.aiKeys.listByOrganization, { organizationId, apiKey }),
    convex.query(api.integrationKeys.listByOrganization, { organizationId, apiKey }),
    convex.query(api.mdlManifests.get, { configId, apiKey }),
  ]);

  if (!manifest) {
    console.log(`[Agent] No V2 manifest found for config ${configId}. Attempting on-the-fly compilation from V1 semantic models...`);
    const [v1Models, v1Rels] = await Promise.all([
      convex.query(api.semanticModels.listModelsByConfig, { configId, apiKey }),
      convex.query(api.semanticRelationships.listByConfig, { configId, apiKey }),
    ]);

    if (!v1Models || v1Models.length === 0) {
      throw new Error("No database schema scan found. Please scan the database schema first to build the semantic layer.");
    }

    manifest = compileToMdl(v1Models, v1Rels, configId, allConfigs);
  }

  // Resolve the primary database config from the already-fetched list
  let config: any = allConfigs.find((c: any) => c._id === configId);
  if (!config) {
    config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId, apiKey });
  }
  if (!config) throw new Error("No ready database configuration found.");

  let dbConfig: any;
  try {
    dbConfig = { ...JSON.parse(config.encryptedUri), type: config.type };
    if (dbConfig.port) dbConfig.port = parseInt(dbConfig.port, 10);
  } catch {
    throw new Error("Failed to parse database configuration.");
  }

  // Build the federation config map
  const allOrgConfigs = allConfigs || [];
  const dbConfigMap = new Map<string, any>();
  const activeIdsSet = new Set(activeConfigIds);

  for (const c of allOrgConfigs) {
    if (!activeIdsSet.has(c._id)) continue;
    try {
      const parsed = { ...JSON.parse(c.encryptedUri), type: c.type };
      if (parsed.port) parsed.port = parseInt(parsed.port, 10);
      const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      dbConfigMap.set(alias, parsed);
    } catch { /* skip malformed configs */ }
  }

  const defaultModel = defaultModelId || "gemini:gemini-1.5-flash";
  const selectedModelStr = modelId || defaultModel;
  const aiModel = resolveModel(selectedModelStr, aiKeys, orgIdStr);
  const pruningModelId = getPruningModelId(selectedModelStr);
  const pruningModel = resolveModel(pruningModelId, aiKeys, orgIdStr);

  // 2. Map the loaded MDL manifest JSON into a structure compatible with our existing agent pipelines
  const allModels = (manifest.models || []).map((m: any) => ({
    _id: m.name,
    tableName: m.name,
    displayName: m.name,
    description: m.description || "",
    remarks: m.remarks || "",
    fields: (m.columns || []).map((c: any) => ({
      columnName: c.name,
      displayName: c.name,
      type: c.type,
      rawType: c.type,
      dataType: c.type,
      description: c.description || "",
      remarks: c.remarks || "",
      isPrimary: m.primaryKey === c.name,
      isNullable: !c.notNull,
      fieldType: c.relationship ? "relationship" : "dimension",
      relationship: c.relationship || null,
      defaultAggregation: c.defaultAggregation || null,
      sqlExpression: c.expression || null,
    }))
  }));

  const mappedRelationships = (manifest.relationships || []).map((rel: any) => {
    const parts = rel.condition.split("=");
    const partA = parts[0].trim();
    const partB = parts[1].trim();
    const fromModelId = partA.substring(0, partA.indexOf("."));
    const toModelId = partB.substring(0, partB.indexOf("."));
    const fromColumn = partA.substring(partA.indexOf(".") + 1);
    const toColumn = partB.substring(partB.indexOf(".") + 1);
    return {
      _id: rel.name,
      name: rel.name,
      fromModelId,
      toModelId,
      fromColumn,
      toColumn,
      type: rel.joinType?.toLowerCase() === "many_to_one" ? "many_to_one" : "one_to_many"
    };
  });

  let filteredModels: any[] = [];
  let relationships: any[] = [];
  let recalledExemplars: any[] = [];
  let recalledInstructions: any[] = [];
  let mcpTools: any = {};
  let compiledManifest: CompiledManifest = { tables: [], relationships: [] };
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastUser: any = lastUserMessage;
  let lastMessage = "";
  if (lastUser) {
    if (typeof lastUser.content === "string" && lastUser.content) {
      lastMessage = lastUser.content;
    } else if (Array.isArray(lastUser.parts)) {
      const textPart = lastUser.parts.find((p: any) => p.type === "text");
      if (textPart?.text) {
        lastMessage = textPart.text;
      }
    } else if (Array.isArray(lastUser.content)) {
      const textPart = lastUser.content.find((p: any) => p.type === "text");
      if (textPart?.text) {
        lastMessage = textPart.text;
      }
    }
  }

  const messageIntent = await classifyIntent(lastMessage, pruningModel);
  console.log(`[Agent] Detected intent: ${messageIntent}`);

  const ragSearchQuery = messageIntent !== "GENERAL_CHAT"
    ? await rewriteConversationalQuery(messages, pruningModel)
    : "";
  const tableNames = allModels.map((m: any) => m.displayName || m.tableName);

  const tableCount = allModels.length;
  const isBypass = tableCount <= 12;

  if (messageIntent === "TEXT_TO_SQL" || messageIntent === "CHART_GENERATION" || messageIntent === "SCHEMA_EXPLORATION") {
    const mcpLoadPromise = (async () => {
      const { loadMcpTools } = (await import("@/lib/mcp-loader")) as any;
      return await loadMcpTools(integrationKeys, orgIdStr);
    })();

    // --- SMALL-SCHEMA RAG BYPASS ---
    if (isBypass) {
      console.log(`[Agent] Small schema detected (table count: ${tableCount} <= 12). Bypassing embedding and vector search.`);
      filteredModels = allModels;
      relationships = mappedRelationships;

      const [mcpResult] = await Promise.allSettled([mcpLoadPromise]);
      if (mcpResult.status === "fulfilled") mcpTools = mcpResult.value;

      compiledManifest = buildManifest(allModels, relationships, dbConfigMap, allOrgConfigs);
    } else {
      console.log(`[Agent] Large schema detected (table count: ${tableCount} > 12). Running vector RAG...`);
      
      const ragAndRecallPromise = (async () => {
        try {
          const mainProvider = selectedModelStr.split(":")[0];
          if (mainProvider === "claude" || mainProvider === "anthropic") {
            console.log(`[Agent] Claude provider selected. Skipping embeddings and running LLM-based table selection...`);
            const matched = await selectTablesWithLLM(ragSearchQuery, allModels, pruningModel);
            return { matchedModels: matched, recallResult: [], recalledInstructions: [] };
          }

          const embedProvider = "local";
          const { embedding, dimensions } = await convex.action(api.embeddings.generateEmbedding, {
            organizationId: organizationId as any,
            text: ragSearchQuery,
            provider: embedProvider,
            sysApiKey: apiKey,
          });
          const indexName = dimensions === 1536 ? "by_embedding_1536" :
            dimensions === 1024 ? "by_embedding_1024" :
            dimensions === 768 ? "by_embedding_768" : "by_embedding_384";

          // Perform vector search on the semanticSearchIndex table
          const relatedModels = await convex.action(api.semanticSearchIndex.searchRelatedModels, {
            configId: config._id,
            embedding,
            indexName,
            limit: 10,
            apiKey,
          }).catch((err: any) => {
            console.warn("[Agent] searchRelatedModels error:", err);
            return [];
          });

          const matchedTableNames = new Set(relatedModels.map((r: any) => r.tableName.toLowerCase()));
          const matchedModels = allModels.filter((m: any) => matchedTableNames.has(m.tableName.toLowerCase()));

          const recallResult = await convex.action(api.semanticMemory.recallQueries, {
            organizationId: organizationId as any,
            configId: config._id,
            embedding,
            indexName,
            limit: 3,
            apiKey,
          }).catch((err: any) => {
            console.warn("[Agent] recallQueries error:", err);
            return [];
          });

          const recalledInstructions = await convex.action(api.semanticInstructions.searchInstructions, {
            configId: config._id,
            embedding,
            indexName,
            limit: 3,
          }).catch((err: any) => {
            console.warn("[Agent] searchInstructions error:", err);
            return [];
          });

          return { matchedModels, recallResult, recalledInstructions };
        } catch (err) {
          console.error("[Agent] dynamic embedding/recall pipeline failed. Falling back to LLM-based table selection...", err);
          const matched = await selectTablesWithLLM(ragSearchQuery, allModels, pruningModel);
          return { matchedModels: matched, recallResult: [], recalledInstructions: [] };
        }
      })();

      const [mcpResult, pipelineResult] = await Promise.allSettled([
        mcpLoadPromise,
        ragAndRecallPromise,
      ]);

      if (mcpResult.status === "fulfilled") mcpTools = mcpResult.value;

      if (pipelineResult.status === "fulfilled") {
        const { matchedModels, recallResult, recalledInstructions: insts } = pipelineResult.value;
        filteredModels = matchedModels;
        recalledExemplars = recallResult || [];
        recalledInstructions = insts || [];
      }

      compiledManifest = buildManifest(allModels, relationships, dbConfigMap, allOrgConfigs);

      // Stage 2: RELATIONSHIP EXPANSION
      if (filteredModels.length > 0) {
        const expandedIds = new Set(filteredModels.map(m => m._id));
        relationships = [];

        for (const rel of mappedRelationships) {
          if (expandedIds.has(rel.fromModelId) || expandedIds.has(rel.toModelId)) {
            const neighborId = expandedIds.has(rel.fromModelId) ? rel.toModelId : rel.fromModelId;
            if (!expandedIds.has(neighborId)) {
              const neighbor = allModels.find((m: any) => m._id === neighborId);
              if (neighbor) {
                console.log(`[Agent] Expanding to neighbor table: ${neighbor.tableName}`);
                filteredModels.push(neighbor);
                expandedIds.add(neighborId);
              }
            }
            if (!relationships.find(r => r._id === rel._id)) {
              relationships.push(rel);
            }
          }
        }

        compiledManifest = buildManifest(allModels, relationships, dbConfigMap, allOrgConfigs);
      }
    }
  } else {
    const { loadMcpTools } = (await import("@/lib/mcp-loader")) as any;
    mcpTools = await loadMcpTools(integrationKeys, orgIdStr);
    console.log(`[Agent] Skipped RAG pipeline for intent: ${messageIntent}`);
  }

  // --- COLUMN PRUNING ---
  if ((messageIntent === "TEXT_TO_SQL" || messageIntent === "CHART_GENERATION") && filteredModels.length > 0) {
    const totalColumns = filteredModels.reduce((sum: number, m: any) => sum + (m.fields?.length || 0), 0);
    if (totalColumns > 50) {
      try {
        const pruned = await pruneColumns(ragSearchQuery, filteredModels, relationships, pruningModel);
        filteredModels = pruned;
      } catch (err) {
        console.warn("[Agent] Column pruning failed, using full schema context:", err);
      }
    }
  }

  // 3. Build prompts using filtered schema models
  const tableDiscoveryList = filteredModels.length === 0 && (messageIntent === "TEXT_TO_SQL" || messageIntent === "CHART_GENERATION")
    ? `### AVAILABLE TABLES:\n- ${tableNames.join("\n- ")}`
    : "";

  const schemaDescription = filteredModels.map((model: any) => {
    let modelCtx = `### ${model.displayName} (USE THIS TABLE NAME: ${model.tableName})\n`;
    if (model.description) modelCtx += `Description: ${model.description}\n`;
    if (model.remarks) modelCtx += `Notes: ${model.remarks}\n`;

    const fields = model.fields.map((f: any) => {
      let d = `- ${f.displayName} (USE THIS IN SQL: ${f.columnName}): ${f.rawType || f.dataType || f.type}`;

      if (f.fieldType === "measure") d += ` [MEASURE: default aggregation=${f.defaultAggregation || 'sum'}]`;
      if (f.fieldType === "dimension") d += ` [DIMENSION]`;
      if (f.isTimeDimension) d += ` [TIME SERIES]`;

      if (f.sqlExpression) d += ` [CALCULATED: ${f.sqlExpression}]`;
      else if (f.expression) d += ` [CALCULATED: ${f.expression}]`;

      if (f.description) d += ` | Info: ${f.description}`;
      if (f.remarks) d += ` | Note: ${f.remarks}`;

      if (f.isPrimary) d += ` (PRIMARY KEY)`;
      return d;
    }).join("\n");

    return `${modelCtx}${fields}`;
  }).join("\n\n");

  const relationshipDescription = relationships?.length > 0
    ? "### Relationships:\n" + relationships.map((rel: any) => {
      const from = filteredModels.find((m: any) => m._id === rel.fromModelId);
      const to = filteredModels.find((m: any) => m._id === rel.toModelId);
      return `- ${from?.tableName ?? "?"}.${rel.fromColumn} → ${to?.tableName ?? "?"}.${rel.toColumn} (${rel.type})`;
    }).join("\n")
    : "";

  const cubeDescription = manifest.cubes && manifest.cubes.length > 0
    ? "\n### Semantic Cubes:\nUse these semantic cubes to answer analytical aggregate questions. Select dimensions and measures from the cube instead of writing raw group-by queries.\n" + manifest.cubes.filter((c: any) => {
        if (filteredModels.length === 0) return false;
        return filteredModels.some((m: any) => (m.tableName === c.baseObject || (m.displayName || m.tableName) === c.baseObject));
      }).map((c: any) => {
        const measuresStr = c.measures.map((m: any) => `  - Measure: "${m.name}" | Type: ${m.type} | Formula: ${m.expression}`).join("\n");
        const dimensionsStr = c.dimensions.map((d: any) => `  - Dimension: "${d.name}" | Type: ${d.type}`).join("\n");
        const timeDimensionsStr = c.timeDimensions.map((t: any) => `  - Time Dimension: "${t.name}" | Type: ${t.type}`).join("\n");
        return `Cube: ${c.name}\nBase Object: ${c.baseObject}\nMeasures:\n${measuresStr || "  (None)"}\nDimensions:\n${dimensionsStr || "  (None)"}\nTime Dimensions:\n${timeDimensionsStr || "  (None)"}`;
      }).join("\n\n")
    : "";

  const dialectRules = getNativeDialectRule(config.type);

  const buildSystemPrompt = (toolNames: string[]) => {
    const mcpToolNames = toolNames.filter(t => t !== "execute_sql" && t !== "query_cube" && t !== "search_db_schema" && t !== "dry_plan_sql");
    const mcpSection = mcpToolNames.length > 0
      ? `### AVAILABLE MCP TOOLS:
You have the following external integrations connected via MCP. YOU MUST use these tools when a user asks about them:
${mcpToolNames.map(n => `- ${n}`).join("\n")}
`
      : "### AVAILABLE MCP TOOLS: No external integrations are connected yet.\n";

    const exemplarsSection = recalledExemplars?.length > 0
      ? "\n### FEW-SHOT EXAMPLES (PAST SUCCESSFUL QUERIES):\n" + recalledExemplars.map((ex: any, idx: number) => {
        return `Example ${idx + 1}:\nNatural Language User Question: "${ex.question}"\nValid Dialect SQL Query: \`\`\`sql\n${ex.sql}\n\`\`\``;
      }).join("\n\n") + "\n"
      : "";

    const instructionsSection = recalledInstructions?.length > 0
      ? "\n### RELEVANT BUSINESS RULES & INSTRUCTIONS:\n" + recalledInstructions.map((inst: any, idx: number) => {
        return `Rule ${idx + 1}: ${inst.title}\nGuideline: ${inst.content}`;
      }).join("\n\n") + "\n"
      : "";
    const skillInstructions = SkillsManager.getSkillInstructions(messageIntent, {
      MAX_ROWS: String(MAX_ROWS),
    });

    return `You are Orcha Agent OS, a database agent with Data Analysis and Tool Integration capabilities.

${mcpSection}

### DATABASE CONTEXT:
${tableDiscoveryList}
${schemaDescription}
${relationshipDescription}
${cubeDescription}
${exemplarsSection}
${instructionsSection}

${dialectRules}

${skillInstructions}
`;
  };

  const tools: any = {
    search_db_schema: {
      description: `[Step 1 — ALWAYS USE FIRST] Searches ALL connected databases for exact table names, column names, types, PKs, and join relationships. Call this BEFORE writing any SQL to confirm correct column names.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          query: { type: "string", description: "Search term for tables or columns." }
        },
        required: ["query"],
      }),
      execute: async ({ query }: { query: string }) => {
        const lowerQuery = query.toLowerCase();
        const matches = allModels.filter((m: any) => {
          const tName = (m.tableName || "").toLowerCase();
          const dName = (m.displayName || "").toLowerCase();
          const desc = (m.description || "").toLowerCase();
          const hasCol = m.fields?.some((f: any) =>
            (f.columnName || "").toLowerCase().includes(lowerQuery) ||
            (f.displayName || "").toLowerCase().includes(lowerQuery) ||
            (f.description || "").toLowerCase().includes(lowerQuery)
          );
          return tName.includes(lowerQuery) || dName.includes(lowerQuery) || desc.includes(lowerQuery) || hasCol;
        });

        if (matches.length === 0) {
          return { success: true, message: `No tables or columns found matching "${query}".` };
        }

        const matchDetails = matches.map((m: any) => {
          const cfg = allOrgConfigs.find((c: any) => c._id === m.configId);
          const dbAlias = cfg ? cfg.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : "";
          const tableRef = dbAlias ? `${dbAlias}.${m.tableName}` : m.tableName;
          const matchedFields = (m.fields || []).map((f: any) => {
            let colStr = `  - ${f.columnName} (${f.type})`;
            if (f.isPrimary) colStr += " PRIMARY KEY";
            if (f.description) colStr += ` | ${f.description}`;
            return colStr;
          }).join("\n");
          
          const joins = compiledManifest.relationships.filter(r =>
            r.toLowerCase().includes(m.tableName.toLowerCase())
          );
          const joinSection = joins.length > 0
            ? `\nJoin conditions:\n${joins.map(j => `  ${j}`).join("\n")}`
            : "";
          return `Table: ${tableRef}\nDescription: ${m.description || "None"}${joinSection}\nColumns:\n${matchedFields}`;
        }).join("\n\n");

        return {
          success: true,
          matchesCount: matches.length,
          schemaDetails: matchDetails
        };
      }
    },
    dry_plan_sql: {
      description: `[Step 2 — DRY-PLAN BEFORE EXECUTING] Validates SQL column and table references against the schema manifest WITHOUT executing it. Call this after search_db_schema and BEFORE execute_sql.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          sql: { type: "string", description: "The SQL query to validate." }
        },
        required: ["sql"],
      }),
      execute: async ({ sql }: { sql: string }) => {
        const result = validateSQL(sql, compiledManifest);
        if (result.valid) {
          return {
            valid: true,
            message: "✅ Dry-plan passed. All references are valid. You may now execute the SQL."
          };
        }
        return {
          valid: false,
          errors: result.errors,
          message: `❌ Dry-plan failed with ${result.errors.length} error(s):\n${result.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
        };
      }
    },
    execute_sql: {
      description: `Executes a SQL SELECT query. Use this tool for data analysis. DO NOT provide a chartConfig unless the user explicitly asked to visualize, chart, graph, or plot the data.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          sql: { type: "string" },
          chartConfig: {
            type: "object",
            description: "Provide this ONLY if the user explicitly asked for a visualization. Defaults to null.",
            properties: {
              chartType: { type: "string", enum: ["bar", "line", "area", "pie", "radar"] },
              title: { type: "string" },
              xKey: { type: "string" },
              yKey: { type: "string" }
            },
            required: ["chartType", "title", "xKey", "yKey"]
          }
        },
        required: ["sql"],
      }),
      execute: async ({ sql, chartConfig }: { sql: string; chartConfig?: any }) => {
        if (!isSafeSQL(sql)) return { success: false, error: "Unsafe SQL blocked." };

        let execSql = sql;
        try {
          const transpiled = await transpileSemanticSQL(
            sql,
            manifest, // Pass the parsed manifest directly to the WASM planning engine
            config.type
          );
          console.log("[Agent] Semantic transpilation succeeded.");
          execSql = transpiled;
        } catch (transpileErr: any) {
          console.warn("[Agent] Semantic transpilation skipped (falling back to raw SQL):", transpileErr?.message || transpileErr);
        }

        const dryPlan = validateSQL(execSql, compiledManifest);
        if (!dryPlan.valid) {
          console.warn("[Agent] execute_sql dry-plan failed:", dryPlan.errors);
          return {
            success: false,
            dryPlanFailed: true,
            errors: dryPlan.errors,
            error: `Schema validation failed before execution:\n${dryPlan.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
          };
        }

        try {
          const schemaName = config.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const rows = await OrchaFusion.execute(execSql, schemaName, dbConfig);

          try {
            convex.mutation(api.semanticMemory.storeQueryMapping, {
              organizationId: organizationId as any,
              configId: config._id,
              question: lastMessage,
              sql: execSql,
              apiKey,
            }).catch((e: any) => console.error("[Agent] Memory store deferred failure:", e));
          } catch (e) {
            console.error("[Agent] Memory store trigger failed:", e);
          }

          return {
            success: true,
            data: rows.slice(0, MAX_ROWS),
            chartConfig
          };
        } catch (err: any) {
          const classified = classifyError(err);
          if (classified.type === ErrorType.OPERATIONAL) {
            throw new Error(`[INFRASTRUCTURE_FAILURE] ${classified.message}`);
          }
          return { success: false, error: `Database error: ${classified.message}. Fix the query and retry.` };
        }
      },
    },
    query_cube: {
      description: `Executes a structured Cube query to retrieve aggregated database metrics. Use this tool for ANY quantitative analysis (such as counts, sums, averages, or breakouts by dimension/time).`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          cube: { type: "string", description: "The exact name of the cube (e.g. 'orders_cube')." },
          measures: {
            type: "array",
            items: { type: "string" },
            description: "List of metric measures to aggregate (e.g. ['amount'])."
          },
          dimensions: {
            type: "array",
            items: { type: "string" },
            description: "List of categorical dimensions to group by."
          },
          timeDimensions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dimension: { type: "string", description: "Name of the time dimension column." },
                granularity: { type: "string", enum: ["day", "month", "year"], description: "Time grouping granularity." }
              },
              required: ["dimension", "granularity"]
            },
            description: "List of time dimensions and their granularities."
          },
          chartConfig: {
            type: "object",
            description: "Provide this ONLY if the user explicitly asked for a visualization. Defaults to null.",
            properties: {
              chartType: { type: "string", enum: ["bar", "line", "area", "pie", "radar"] },
              title: { type: "string" },
              xKey: { type: "string", description: "The exact column/alias on the X-axis." },
              yKey: { type: "string", description: "The exact column/alias on the Y-axis." }
            },
            required: ["chartType", "title", "xKey", "yKey"]
          }
        },
        required: ["cube"],
      }),
      execute: async ({ cube, measures, dimensions, timeDimensions, chartConfig }: { cube: string; measures?: string[]; dimensions?: string[]; timeDimensions?: any[]; chartConfig?: any }) => {
        try {
          const { transpileCubeQuery } = await import("./semantic-transpiler");
          
          let execSql = transpileCubeQuery(
            { cube, measures, dimensions, timeDimensions },
            manifest,
            config.type
          );
          
          console.log(`[Agent] Translated Cube Query to SQL: ${execSql}`);

          const dryPlan = validateSQL(execSql, compiledManifest);
          if (!dryPlan.valid) {
            console.warn("[Agent] Cube Query execute dry-plan failed:", dryPlan.errors);
            return {
              success: false,
              dryPlanFailed: true,
              errors: dryPlan.errors,
              error: `Compiled SQL validation failed:\n${dryPlan.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
            };
          }

          const schemaName = config.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const rows = await OrchaFusion.execute(execSql, schemaName, dbConfig);

          try {
            convex.mutation(api.semanticMemory.storeQueryMapping, {
              organizationId: organizationId as any,
              configId: config._id,
              question: lastMessage,
              sql: execSql,
              apiKey,
            }).catch((e: any) => console.error("[Agent] Memory store deferred failure:", e));
          } catch (memErr) {
            console.warn("[Agent] Failed to store query mapping:", memErr);
          }

          const returnData: any = {
            success: true,
            data: rows.slice(0, MAX_ROWS),
            totalCount: rows.length,
            sql: execSql
          };

          if (chartConfig) {
            returnData.chartConfig = chartConfig;
          }

          return returnData;
        } catch (err: any) {
          console.error("[Agent] Cube Query execution failed:", err);
          const classified = classifyError(err);
          if (classified.type === ErrorType.OPERATIONAL) {
            throw new Error(`[INFRASTRUCTURE_FAILURE] ${classified.message}`);
          }
          return {
            success: false,
            error: `Semantic Cube error: ${classified.message}. Adjust properties and retry.`
          };
        }
      }
    },
  };

  Object.assign(tools, mcpTools);
  const toolNames = Object.keys(tools);
  console.log(`[ChatAgent] Loaded tools: ${toolNames.join(", ")}`);

  return new ToolLoopAgent({
    model: aiModel,
    instructions: buildSystemPrompt(toolNames),
    tools,
    stopWhen: stepCountIs(4),
  });
}
