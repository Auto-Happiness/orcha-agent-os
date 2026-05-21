import { UIMessage, jsonSchema, ToolLoopAgent, stepCountIs, convertToModelMessages } from "ai";
import { resolveModel } from "./model-resolver";
import { pruneColumns, getPruningModelId } from "./column-pruner";
import { api } from "@/convex/_generated/api";
import { OrchaFusion } from "./engine/orcha-fusion";
import { classifyIntent } from "./intent-classifier";
import { getNativeDialectRule, getFederatedRule } from "./dialects";
import { buildManifest, validateSQL, CompiledManifest } from "./sql-validator";

const MAX_ROWS = 50;
const ALLOWED_SQL_PREFIXES = ["select", "show", "describe", "explain", "with"];

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

export async function createChatAgent(context: AgentContext) {
  const { convex, organizationId, configId: rawConfigId, configIds: rawConfigIds, modelId, showResults, messages, userId, orgIdStr, apiKey, defaultModelId, defaultConfigId } = context;

  // If multiple IDs provided, the first one is the "primary" context
  const activeConfigIds = rawConfigIds && rawConfigIds.length > 0
    ? rawConfigIds
    : (rawConfigId ? [rawConfigId] : (defaultConfigId ? [defaultConfigId] : []));

  const configId = activeConfigIds[0];

  // ── PARALLEL FETCH: Fire all org-level queries simultaneously ──
  // allConfigs, aiKeys, integrationKeys, and allOrgModels are fully independent —
  // bundling them into one Promise.all saves ~3 sequential network round-trips per request.
  const [allConfigs, aiKeys, integrationKeys, allOrgModels] = await Promise.all([
    convex.query(api.databaseConfigs.listByOrganization, { organizationId, apiKey }),
    convex.query(api.aiKeys.listByOrganization, { organizationId, apiKey }),
    convex.query(api.integrationKeys.listByOrganization, { organizationId, apiKey }),
    convex.query(api.semanticModels.listAllModelsInOrg, { organizationId, apiKey }),
  ]);

  // Resolve the primary database config from the already-fetched list
  let config: any = allConfigs.find((c: any) => c._id === configId);
  if (!config) {
    // Fallback: fetch any ready config for the org (e.g. when no configId is supplied)
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

  // Build the federation config map (uses allConfigs resolved above)
  const allOrgConfigs = allConfigs || [];
  const dbConfigMap = new Map<string, any>();
  const activeIdsSet = new Set(activeConfigIds);

  for (const c of allOrgConfigs) {
    if (!activeIdsSet.has(c._id)) continue; // Filter to only selected databases
    try {
      const parsed = { ...JSON.parse(c.encryptedUri), type: c.type };
      if (parsed.port) parsed.port = parseInt(parsed.port, 10);
      const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      dbConfigMap.set(alias, parsed);
    } catch { /* skip malformed configs */ }
  }

  // If a default model is set for the API key, use it.
  const defaultModel = defaultModelId || "gemini:gemini-1.5-flash";

  const selectedModelStr = modelId || defaultModel;
  const aiModel = resolveModel(selectedModelStr, aiKeys, orgIdStr);
  const pruningModelId = getPruningModelId(selectedModelStr);
  const pruningModel = resolveModel(pruningModelId, aiKeys, orgIdStr);

  let filteredModels: any[] = [];
  let relationships: any[] = [];
  let recalledExemplars: any[] = [];
  let mcpTools: any = {};
  // allModels (full field schemas) is fetched lazily inside the TEXT_TO_SQL branch
  let allModels: any[] = [];
  let compiledManifest: CompiledManifest = { tables: [], relationships: [] };
  const lastMessage = (messages[messages.length - 1] as any)?.content || "";

  // --- INTENT CLASSIFICATION ---
  // Derive table names from allOrgModels fetched in the parallel block above — zero extra cost.
  const tableNames = allOrgModels
    .filter((m: any) => m.configId === config._id)
    .map((m: any) => m.displayName || m.tableName);

  // classifyIntent is temporarily commented out for now
  // const classification = await classifyIntent(lastMessage, aiModel, tableNames, config.businessContext);
  // const messageIntent = classification.intent;
  // const suggestedTables = classification.suggestedTables;
  const messageIntent = "TEXT_TO_SQL";
  const suggestedTables: string[] = [];
  console.log(`[Agent] Intent Classification bypassed, defaulting to: ${messageIntent}`);

  // Only run the expensive RAG pipeline for data queries
  if (messageIntent === "TEXT_TO_SQL") {
    // ── CONCURRENT TEXT_TO_SQL LOAD ──
    // MCP tools, RAG embedding + vector search, and full model schemas all fire in parallel.
    // Previously these were sequential; now they all complete in the time of the slowest one.
    const mcpLoadPromise = (async () => {
      const { loadMcpTools } = (await import("@/lib/mcp-loader")) as any;
      return await loadMcpTools(integrationKeys, orgIdStr);
    })();

    const ragAndRecallPromise = (async () => {
      try {
        const embedProvider: "openai" | "gemini" | "local" = (config.memoryProvider as any) || "gemini";
        const { embedding, dimensions } = await convex.action(api.embeddings.generateEmbedding, {
          organizationId: organizationId as any,
          text: lastMessage,
          provider: embedProvider,
          sysApiKey: apiKey,
        });
        const indexName = dimensions === 1536 ? "by_embedding_1536" :
          dimensions === 1024 ? "by_embedding_1024" : "by_embedding_768";

        const [ragResult, recallResult] = await Promise.all([
          convex.action(api.semanticModels.retrieveSchemaContext, {
            configId: config._id,
            embedding,
            indexName,
            limit: 10,
            apiKey,
          }).catch((err: any) => {
            console.warn("[Agent] retrieveSchemaContext error:", err);
            return { models: [], relationships: [] };
          }),
          convex.action(api.semanticMemory.recallQueries, {
            organizationId: organizationId as any,
            configId: config._id,
            embedding,
            indexName,
            limit: 3,
            apiKey,
          }).catch((err: any) => {
            console.warn("[Agent] recallQueries error:", err);
            return [];
          })
        ]);

        return { ragResult, recallResult };
      } catch (err) {
        console.error("[Agent] dynamic embedding/recall pipeline failed:", err);
        return { ragResult: { models: [], relationships: [] }, recallResult: [] };
      }
    })();

    // Full model schemas (with fields) for ALL active configs — primary + federated secondaries.
    // Running all fetches in parallel so federated mode pays no extra sequential cost.
    const allModelsPromises = activeConfigIds.map((cid: string) =>
      convex.query(api.semanticModels.listModelsByConfig, { configId: cid as any, apiKey })
        .catch(() => [] as any[])
    );
    const allModelsPromise = Promise.all(allModelsPromises);

    const [mcpResult, pipelineResult, allModelsResult] = await Promise.allSettled([
      mcpLoadPromise,
      ragAndRecallPromise,
      allModelsPromise,
    ]);

    if (mcpResult.status === "fulfilled") mcpTools = mcpResult.value;

    if (pipelineResult.status === "fulfilled") {
      const { ragResult, recallResult } = pipelineResult.value;
      if (ragResult?.models?.length > 0) {
        filteredModels = ragResult.models;
        relationships = ragResult.relationships;
      }
      recalledExemplars = recallResult || [];
    }

    // Merge all models from all active configs into one flat array for fuzzy fallback & search_db_schema
    if (allModelsResult.status === "fulfilled") {
      const perConfigResults = allModelsResult.value as any[][];
      allModels = perConfigResults.flat();
    }

    // Build the compiled manifest for pre-execution dry-plan validation.
    // Done here so it uses the fully merged allModels + relationships from dependency expansion.
    // NOTE: relationships is populated later in Stage 2 expansion below; manifest is rebuilt after.
    compiledManifest = buildManifest(allModels, relationships, dbConfigMap, allOrgConfigs);

    // HYBRID DISCOVERY: Merge LLM-suggested tables with RAG results
    if (suggestedTables.length > 0) {
      const lowerSuggestions = suggestedTables.map(t => t.toLowerCase());
      const suggestedModels = allModels.filter((m: any) => {
        const dName = (m.displayName || "").toLowerCase();
        const tName = (m.tableName || "").toLowerCase();
        return lowerSuggestions.includes(dName) || lowerSuggestions.includes(tName);
      });

      // Stage 1: Add suggested models
      const newModelIds = new Set(filteredModels.map(m => m._id));
      for (const sm of suggestedModels) {
        if (!newModelIds.has(sm._id)) {
          console.log(`[Agent] Adding LLM-suggested table: ${sm.tableName}`);
          filteredModels.push(sm);
          newModelIds.add(sm._id);
        }
      }
    }

    // Stage 2: DEPENDENCY EXPANSION 
    // Pull in 1st-degree relationships for any table we've found so far
    if (filteredModels.length > 0) {
      const allRels = await convex.query(api.semanticRelationships.listByConfig, { configId: config._id, apiKey });
      const expandedIds = new Set(filteredModels.map(m => m._id));

      for (const rel of allRels) {
        if (expandedIds.has(rel.fromModelId) || expandedIds.has(rel.toModelId)) {
          // Add both sides of the relationship
          const neighborId = expandedIds.has(rel.fromModelId) ? rel.toModelId : rel.fromModelId;
          if (!expandedIds.has(neighborId)) {
            const neighbor = allModels.find((m: any) => m._id === neighborId);
            if (neighbor) {
              console.log(`[Agent] Expanding to neighbor table: ${neighbor.tableName}`);
              filteredModels.push(neighbor);
              expandedIds.add(neighborId);
            }
          }
          // Also track this relationship to show in prompt
          if (!relationships.find(r => r._id === rel._id)) {
            relationships.push(rel);
          }
        }
      }

      // Rebuild manifest now that relationships are fully expanded
      compiledManifest = buildManifest(allModels, relationships, dbConfigMap, allOrgConfigs);
    }
  } else {
    // GENERAL / IRRELEVANT: skip the entire RAG + embedding pipeline.
    // Only load MCP tools in case the user is asking about an integration.
    const { loadMcpTools } = (await import("@/lib/mcp-loader")) as any;
    mcpTools = await loadMcpTools(integrationKeys, orgIdStr);
    console.log(`[Agent] Skipped RAG pipeline for intent: ${messageIntent}`);
  }

  // Fallback for databases without embeddings or very small databases
  if (messageIntent === "TEXT_TO_SQL" && (!filteredModels || filteredModels.length === 0)) {
    console.warn("[Agent] RAG returned no results. Running Instant Fuzzy Matcher...");

    // Fuzzy match: Look for query keywords in table names
    const queryWords = lastMessage.toLowerCase().split(/\s+/);
    const fuzzyMatches = allModels.filter((m: any) => {
      const name = (m.displayName || m.tableName || "").toLowerCase();
      return queryWords.some((word: string) => word.length > 3 && (name.includes(word) || word.includes(name)));
    });

    if (fuzzyMatches.length > 0) {
      console.log(`[Agent] Fuzzy Matcher found ${fuzzyMatches.length} tables.`);
      filteredModels = fuzzyMatches.slice(0, 5); // Limit to top 5 fuzzy matches
    } else if (allModels.length <= 15) {
      filteredModels = allModels;
    } else {
      filteredModels = []; // Truly no match, show discovery list
    }
  }

  // --- COLUMN PRUNING ---
  // Only prune when there are genuinely many columns (> 150 total).
  // For small/simple schemas, pruning adds an extra LLM call with no benefit
  // and can actually hurt accuracy by stripping columns the AI needs.
  if (messageIntent === "TEXT_TO_SQL" && filteredModels.length > 0) {
    const totalColumns = filteredModels.reduce((sum: number, m: any) => sum + (m.fields?.length || 0), 0);
    if (totalColumns > 150) {
      try {
        const pruned = await pruneColumns(lastMessage, filteredModels, relationships, pruningModel);
        filteredModels = pruned;
      } catch (err) {
        console.warn("[Agent] Column pruning failed, using full schema context:", err);
        // Intentionally fall through — original filteredModels remain intact
      }
    } else {
      console.log(`[Agent] Skipping pruning: total columns (${totalColumns}) below threshold.`);
    }
  }

  // 6. Build Prompt
  const tableDiscoveryList = filteredModels.length === 0 && messageIntent === "TEXT_TO_SQL"
    ? `### AVAILABLE TABLES (Discovery Mode):\n- ${tableNames.join("\n- ")}`
    : "";
  const schemaDescription = filteredModels.map((model: any) => {
    let modelCtx = `### ${model.displayName} (USE THIS TABLE NAME: ${model.tableName})\n`;
    if (model.description) modelCtx += `Description: ${model.description}\n`;
    if (model.remarks) modelCtx += `Notes: ${model.remarks}\n`;

    const fields = model.fields.map((f: any) => {
      let d = `- ${f.displayName} (USE THIS IN SQL: ${f.columnName}): ${f.type}`;

      // BI Metadata & Semantic Hints
      if (f.fieldType === "measure") d += ` [MEASURE: default aggregation=${f.defaultAggregation || 'sum'}]`;
      if (f.fieldType === "dimension") d += ` [DIMENSION]`;
      if (f.isTimeDimension) d += ` [TIME SERIES]`;

      if (f.sqlExpression) d += ` [CALCULATED: ${f.sqlExpression}]`;
      else if (f.expression) d += ` [CALCULATED: ${f.expression}]`; // Legacy fallback

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

  // Build a federated catalog for the prompt — includes FULL column schema per database.
  // allModels already contains merged schemas for all active configs (loaded above).
  const federatedCatalog = allOrgConfigs
    .filter((c: any) => activeIdsSet.has(c._id))
    .map((c: any) => {
      const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const dbModels = allModels.filter((m: any) => m.configId === c._id);

      if (dbModels.length === 0) {
        return `- [${c.type.toUpperCase()}] alias: **${alias}** (No tables detected — run a schema scan)`;
      }

      // For the primary config, schema is already in schemaDescription — skip duplication
      if (c._id === config._id) {
        const tableList = dbModels.map((m: any) => m.tableName).join(", ");
        return `- [${c.type.toUpperCase()}] alias: **${alias}** — PRIMARY DB (Tables: ${tableList})`;
      }

      // For secondary databases: include full column schema so the agent never guesses
      const tableSchemas = dbModels.map((m: any) => {
        const cols = (m.fields || []).map((f: any) => {
          let col = `    - ${f.columnName} (${f.type})`;
          if (f.isPrimary) col += " PRIMARY KEY";
          if (f.description) col += ` | ${f.description}`;
          return col;
        }).join("\n");
        return `  ### ${m.tableName} (alias.table: ${alias}.${m.tableName})\n${cols}`;
      }).join("\n");

      return `- [${c.type.toUpperCase()}] alias: **${alias}**\n${tableSchemas}`;
    }).join("\n");

  const dialectRules = getNativeDialectRule(config.type);
  const federatedRule = dbConfigMap.size > 1 ? getFederatedRule(federatedCatalog, config.name) : "";

  const buildSystemPrompt = (toolNames: string[]) => {
    const mcpToolNames = toolNames.filter(t => t !== "execute_sql");
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

    return `You are Orcha Agent OS, a powerful AI system with dual capabilities: Data Analysis and Tool Integration.

${mcpSection}

### DATABASE CONTEXT:
${tableDiscoveryList}
${schemaDescription}
${relationshipDescription}
${exemplarsSection}

${dialectRules}
${federatedRule}

### CRITICAL INSTRUCTIONS:
1. SQL SYNTAX: NEVER use the "Display Name" (e.g. 'Created At') in your SQL queries. ALWAYS use the raw "columnName" or "tableName" provided in the parentheses. Failure to do this will cause a database error.
2. NATIVE FIRST: Prioritize the native SQL dialect mentioned above (e.g. use SELECT TOP for MSSQL).
3. DISCOVERY: Use the provided schema context to identify tables and columns.
4. LIMIT: Always limit results to ${MAX_ROWS} rows.

### MANDATORY QUERY WORKFLOW  ALWAYS follow this order:

Step 1 — CHECK SCHEMA FIRST (before writing any SQL):
- Use search_db_schema to confirm EXACT table names and column names.
- NEVER guess a column name. If you are unsure, call search_db_schema.
- Example: search_db_schema({ query: "review" }) → confirms the correct column is "review_text", not "review_id".

Step 2 — DRY-PLAN BEFORE EXECUTING (for any non-trivial JOIN or unfamiliar table):
- Call dry_plan_sql with your intended SQL BEFORE calling execute_sql or execute_federated_sql.
- If dry_plan_sql returns errors, fix the SQL and re-validate. Do NOT execute invalid SQL.
- Only skip dry_plan_sql for single-table queries on tables you have already verified in Step 1.

Step 3 — EXECUTE:
- Only call execute_sql / execute_federated_sql after dry_plan_sql passes (or Step 1 fully confirmed the schema).

Step 4 — STORE (automatic):
- Successful queries are automatically stored in semantic memory. No action needed.

### REASONING PHASE (CRITICAL):
- BEFORE providing any final answer or executing any tools, you MUST provide a brief "Thinking Process" to explain your logic to the user.
- Start your response with "### 🧠 Reasoning" followed by a few bullet points explaining how you interpret the question and which tools/tables you intend to use.
- Keep the reasoning high-level and clear for a non-technical business user. Do NOT include raw SQL in this section.

- STRICTLY FORBIDDEN: Do NOT output a chart unless the user explicitly used words like "visualize", "chart", "graph", or "plot". If they just ask for a list or a question, only show the table.
- To plot a chart, you MUST use the execute_sql tool and provide the optional chartConfig object.
- THE FRONTEND AUTOMATICALLY RENDERS THE CHART IF chartConfig IS PROVIDED. DO NOT output markdown image links (e.g. ![chart](...)) or attempt to display the chart yourself in the text.
- Choose the most appropriate chartType:
  - "bar"  → comparisons between categories
  - "line" → trends over time or ordered sequences
  - "area" → cumulative trends
  - "pie"  → proportions / part-of-whole (use only if there are ≤ 8 categories)
- xKey must be the EXACT column name or alias for the X-axis (or pie labels) as returned by your SQL query.
- yKey must be the EXACT column name or alias for the Y-axis value as returned by your SQL query (e.g. "revenue"). Use AS aliases in your SQL to ensure clean keys.

### SCOPE & CAPABILITIES (CRITICAL):
- Your mission is STRICTLY limited to:
  1. Performing data analysis and SQL queries on the provided database schema.
  2. Fulfilling user requests using your connected MCP tools (integrations).
- You have UNRESTRICTED access to use any available tool in your toolbox to answer questions or perform actions related to these two areas.
- IF A USER ASKS ABOUT A SYSTEM OR INTEGRATION, CHECK YOUR AVAILABLE TOOLS LIST ABOVE. Do not claim you cannot access external systems if you have a tool for it.
- Decline any request that is NOT related to your database or your connected tools (e.g. general knowledge, personal advice, or unrelated technical help).
`;
  };

  // 7. Initialize Agent
  const tools: any = {
    search_db_schema: {
      description: `[Step 1 — ALWAYS USE FIRST] Searches ALL connected databases for exact table names, column names, types, PKs, and join relationships. Call this BEFORE writing any SQL to confirm correct column names. Never guess — always verify here first.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          query: { type: "string", description: "Search term for tables or columns (e.g. 'review', 'customer_id', 'orders')." }
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
          return { success: true, message: `No tables or columns found matching "${query}". Try a broader search term.` };
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
          // Also show relevant join conditions from the manifest
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
      description: `[Step 2 — DRY-PLAN BEFORE EXECUTING] Validates SQL column and table references against the schema manifest WITHOUT executing it. Call this after search_db_schema and BEFORE execute_sql / execute_federated_sql for any JOIN query or unfamiliar table. Returns a list of errors to fix if any column or table name is wrong.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          sql: { type: "string", description: "The SQL query to validate against the schema manifest." }
        },
        required: ["sql"],
      }),
      execute: async ({ sql }: { sql: string }) => {
        const result = validateSQL(sql, compiledManifest);
        if (result.valid) {
          return {
            valid: true,
            message: "✅ Dry-plan passed. All table and column references are valid. You may now execute the SQL."
          };
        }
        return {
          valid: false,
          errors: result.errors,
          message: `❌ Dry-plan failed with ${result.errors.length} error(s). Fix these before executing:\n${result.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
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
            description: "CRITICAL: Provide this ONLY if the user explicitly asked for a visualization. Defaults to null.",
            properties: {
              chartType: { type: "string", enum: ["bar", "line", "area", "pie"], description: "The type of chart to render." },
              title: { type: "string", description: "A short descriptive title for the chart." },
              xKey: { type: "string", description: "The column name to use for the X-axis (or labels in a pie chart)." },
              yKey: { type: "string", description: "The column name for the Y-axis values (or value in a pie chart). Example: 'sales'" }
            },
            required: ["chartType", "title", "xKey", "yKey"]
          }
        },
        required: ["sql"],
      }),
      execute: async ({ sql, chartConfig }: { sql: string; chartConfig?: any }) => {
        if (!isSafeSQL(sql)) return { success: false, error: "Unsafe SQL blocked." };

        // Pre-execution dry-plan: validate column/table references before hitting the DB
        const dryPlan = validateSQL(sql, compiledManifest);
        if (!dryPlan.valid) {
          console.warn("[Agent] execute_sql dry-plan failed:", dryPlan.errors);
          return {
            success: false,
            dryPlanFailed: true,
            errors: dryPlan.errors,
            error: `Schema validation failed before execution. Fix these errors and use dry_plan_sql to re-verify:\n${dryPlan.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
          };
        }

        try {
          const schemaName = config.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const rows = await OrchaFusion.execute(sql, schemaName, dbConfig);

          // Store successful query in Convex semanticMemory in background
          try {
            convex.mutation(api.semanticMemory.storeQueryMapping, {
              organizationId: organizationId as any,
              configId: config._id,
              question: lastMessage,
              sql: sql,
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
          return { success: false, error: err.message || "Failed to execute SQL." };
        }
      },
    },
  };

  // Only expose federated queries if there are genuinely multiple databases selected
  if (dbConfigMap.size > 1) {
    tools.execute_federated_sql = {
      description: `Executes a SQL query that JOINs data across MULTIPLE databases using alias.table syntax. Use this ONLY when the user needs data from more than one connected database. Do NOT use chartConfig unless the user explicitly asked for a visualization.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          sql: { type: "string", description: "Federated SQL query using alias.table syntax (e.g. items_db.items JOIN orders_db.orders)" },
          chartConfig: {
            type: "object",
            description: "CRITICAL: Provide this ONLY if the user explicitly asked for a visualization.",
            properties: {
              chartType: { type: "string", enum: ["bar", "line", "area", "pie"] },
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

        // Pre-execution dry-plan: validate column/table references across all federated DBs
        const dryPlan = validateSQL(sql, compiledManifest);
        if (!dryPlan.valid) {
          console.warn("[Agent] execute_federated_sql dry-plan failed:", dryPlan.errors);
          return {
            success: false,
            dryPlanFailed: true,
            errors: dryPlan.errors,
            error: `Schema validation failed before federated execution. Fix these errors and use dry_plan_sql to re-verify:\n${dryPlan.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
          };
        }

        try {
          console.log("[Agent] Executing FEDERATED query across", dbConfigMap.size, "databases");
          const rows = await OrchaFusion.executeMulti(sql, dbConfigMap);

          // Store successful query in Convex semanticMemory in background
          try {
            convex.mutation(api.semanticMemory.storeQueryMapping, {
              organizationId: organizationId as any,
              configId: config._id,
              question: lastMessage,
              sql: sql,
              apiKey,
            }).catch((e: any) => console.error("[Agent] Memory store deferred failure:", e));
          } catch (e) {
            console.error("[Agent] Memory store trigger failed:", e);
          }

          return {
            success: true,
            data: rows.slice(0, MAX_ROWS),
            chartConfig,
            federated: true,
            sourceDatabases: Array.from(dbConfigMap.keys()),
          };
        } catch (err: any) {
          return { success: false, error: err.message || "Federated query failed." };
        }
      },
    };
  }

  // Merge loaded MCP tools
  Object.assign(tools, mcpTools);

  const toolNames = Object.keys(tools);
  console.log(`[ChatAgent] Loaded tools: ${toolNames.join(", ")}`);

  return new ToolLoopAgent({
    model: aiModel,
    instructions: buildSystemPrompt(toolNames),
    tools,
    stopWhen: stepCountIs(10),
  });
}

