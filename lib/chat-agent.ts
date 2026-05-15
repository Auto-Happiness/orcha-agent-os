import { UIMessage, jsonSchema, ToolLoopAgent, stepCountIs, convertToModelMessages } from "ai";
import { resolveModel } from "./model-resolver";
import { pruneColumns, getPruningModelId } from "./column-pruner";
import { api } from "@/convex/_generated/api";
import { OrchaFusion } from "./engine/orcha-fusion";
import { classifyIntent } from "./intent-classifier";

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

  let config: any;
  const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId, apiKey });
  config = allConfigs.find((c: any) => c._id === configId);
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

  // Build a connection config map for the selected databases (for federation)
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

  const [aiKeys, integrationKeys] = await Promise.all([
    convex.query(api.aiKeys.listByOrganization, { organizationId, apiKey }),
    convex.query(api.integrationKeys.listByOrganization, { organizationId, apiKey }),
  ]);

  // If a default model is set for the API key, use it.
  const defaultModel = defaultModelId || "gemini:gemini-1.5-flash";

  const selectedModelStr = modelId || defaultModel;
  const aiModel = resolveModel(selectedModelStr, aiKeys, orgIdStr);

  let filteredModels: any[] = [];
  let relationships: any[] = [];
  let mcpTools: any = {};
  const lastMessage = (messages[messages.length - 1] as any)?.content || "";

  // --- INTENT CLASSIFICATION  ---
  // 1. Get a quick list of table names to help the classifier
  const allModels = await convex.query(api.semanticModels.listModelsByConfig, { configId: config._id, apiKey });
  const tableNames = allModels.map((m: any) => m.displayName || m.tableName);

  // 2. Classify intent (TEMPORARILY DISABLED)
  // const classification = await classifyIntent(lastMessage, aiModel, tableNames, config.businessContext);
  // const messageIntent = classification.intent;
  // const suggestedTables = classification.suggestedTables;
  const messageIntent = "TEXT_TO_SQL";
  const suggestedTables: string[] = [];
  console.log(`[Agent] Intent Classification bypassed, defaulting to: ${messageIntent}`);

  // Run MCP tool loading in the background
  const mcpLoadPromise = (async () => {
    const { loadMcpTools } = (await import("@/lib/mcp-loader")) as any;
    return await loadMcpTools(integrationKeys, orgIdStr);
  })();

  // Only run the expensive RAG pipeline for data queries
  if (messageIntent === "TEXT_TO_SQL") {
    const ragPromise = (async () => {
      const embedProvider: "openai" | "gemini" | "local" = (config.memoryProvider as any) || "gemini";
      const { embedding, dimensions } = await convex.action(api.embeddings.generateEmbedding, {
        organizationId: organizationId as any,
        text: lastMessage,
        provider: embedProvider,
        sysApiKey: apiKey,
      });
      const indexName = dimensions === 1536 ? "by_embedding_1536" :
        dimensions === 1024 ? "by_embedding_1024" : "by_embedding_768";
      return await convex.action(api.semanticModels.retrieveSchemaContext, {
        configId: config._id,
        embedding,
        indexName,
        limit: 10,
        apiKey,
      });
    })();

    const [mcpResult, ragResult] = await Promise.allSettled([mcpLoadPromise, ragPromise]);

    if (mcpResult.status === "fulfilled") mcpTools = mcpResult.value;

    if (ragResult.status === "fulfilled" && ragResult.value?.models?.length > 0) {
      filteredModels = ragResult.value.models;
      relationships = ragResult.value.relationships;
    }

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

      // Stage 2: DEPENDENCY EXPANSION (WrenAI pattern)
      // Pull in 1st-degree relationships for any table we've found so far
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
    }
  } else {
    // GENERAL / IRRELEVANT: skip RAG, just load MCP tools
    mcpTools = await mcpLoadPromise;
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

  // 6. Build Prompt
  const tableDiscoveryList = filteredModels.length === 0 && messageIntent === "TEXT_TO_SQL"
    ? `### AVAILABLE TABLES (Discovery Mode):\n- ${tableNames.join("\n- ")}`
    : "";
  const schemaDescription = filteredModels.map((model: any) => {
    const fields = model.fields.map((f: any) => {
      let d = `- ${f.displayName} (USE THIS IN SQL: ${f.columnName}): ${f.type}`;
      if (f.expression) d += ` [CALCULATED: ${f.expression}]`;
      if (f.aggregation) d += `, aggregation: ${f.aggregation}`;
      if (f.isPrimary) d += ` (PRIMARY KEY)`;
      return d;
    }).join("\n");
    return `### ${model.displayName} (USE THIS TABLE NAME: ${model.tableName})\n${fields}`;
  }).join("\n\n");

  const relationshipDescription = relationships?.length > 0
    ? "### Relationships:\n" + relationships.map((rel: any) => {
      const from = filteredModels.find((m: any) => m._id === rel.fromModelId);
      const to = filteredModels.find((m: any) => m._id === rel.toModelId);
      return `- ${from?.tableName ?? "?"}.${rel.fromColumn} → ${to?.tableName ?? "?"}.${rel.toColumn} (${rel.type})`;
    }).join("\n")
    : "";

  const dialectRules = config.type === "mssql"
    ? "- Dialect: T-SQL (Microsoft SQL Server). ALWAYS use 'SELECT TOP N' instead of 'LIMIT'. Use square brackets [table] or [column] if needed."
    : config.type === "mysql"
      ? "- Dialect: MySQL. Use backticks `table` for reserved names."
      : "- Dialect: PostgreSQL. Use double quotes \"table\" for reserved names.";

  // Build a federated catalog for the prompt (only for selected databases)
  const allOrgModels = await convex.query(api.semanticModels.listAllModelsInOrg, { organizationId, apiKey });
  const federatedCatalog = allOrgConfigs
    .filter((c: any) => activeIdsSet.has(c._id))
    .map((c: any) => {
      const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const dbTables = allOrgModels
        .filter((m: any) => m.configId === c._id)
        .map((m: any) => m.tableName)
        .join(", ");

      return `- [${c.type.toUpperCase()}] alias: **${alias}** (Tables: ${dbTables || "none detected"})`;
    }).join("\n");

  const federatedRule = `
### FEDERATED QUERY RULE:
- You have access to MULTIPLE databases in this organization.
- To JOIN across databases, use the alias prefix: alias.table_name
- Example: SELECT i.name, o.quantity FROM items_db.items i JOIN orders_db.orders o ON i.sku = o.item_sku
- Use the 'execute_federated_sql' tool for any query that spans more than one database.
- Use the standard 'execute_sql' tool for single-database queries only.

### CONNECTED DATABASES (Federation Catalog):
${federatedCatalog || "No additional databases connected."}
`;

  const buildSystemPrompt = (toolNames: string[]) => {
    const mcpToolNames = toolNames.filter(t => t !== "execute_sql");
    const mcpSection = mcpToolNames.length > 0
      ? `### AVAILABLE MCP TOOLS:
You have the following external integrations connected via MCP. YOU MUST use these tools when a user asks about them:
${mcpToolNames.map(n => `- ${n}`).join("\n")}
`
      : "### AVAILABLE MCP TOOLS: No external integrations are connected yet.\n";

    return `You are Orcha Agent OS, a powerful AI system with dual capabilities: Data Analysis and Tool Integration.

${mcpSection}

### DATABASE CONTEXT:
${tableDiscoveryList}
${schemaDescription}
${relationshipDescription}

${dialectRules}
${federatedRule}

### CRITICAL INSTRUCTIONS:
1. SQL SYNTAX: NEVER use the "Display Name" (e.g. 'Created At') in your SQL queries. ALWAYS use the raw "columnName" or "tableName" provided in the parentheses. Failure to do this will cause a database error.
2. NATIVE FIRST: Prioritize the native SQL dialect mentioned above (e.g. use SELECT TOP for MSSQL).
3. DISCOVERY: Use the provided schema context to identify tables and columns.
4. LIMIT: Always limit results to ${MAX_ROWS} rows.

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
  const tools = {
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
        try {
          const schemaName = config.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const rows = await OrchaFusion.execute(sql, schemaName, dbConfig);
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
    execute_federated_sql: {
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
        try {
          console.log("[Agent] Executing FEDERATED query across", dbConfigMap.size, "databases");
          const rows = await OrchaFusion.executeMulti(sql, dbConfigMap);
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
    },
    ...mcpTools,
  };

  const toolNames = Object.keys(tools);
  console.log(`[ChatAgent] Loaded tools: ${toolNames.join(", ")}`);

  return new ToolLoopAgent({
    model: aiModel,
    instructions: buildSystemPrompt(toolNames),
    tools,
    stopWhen: stepCountIs(10),
  });
}

