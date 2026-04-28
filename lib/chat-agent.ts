import { UIMessage, jsonSchema, ToolLoopAgent, stepCountIs, convertToModelMessages } from "ai";
import { resolveModel } from "./model-resolver";
import { DbExecutor } from "./db-executor";
import { api } from "@/convex/_generated/api";

const MAX_ROWS = 50;
const ALLOWED_SQL_PREFIXES = ["select", "show", "describe", "explain", "with"];

function isSafeSQL(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  return ALLOWED_SQL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export interface AgentContext {
  convex: any;
  organizationId: string;
  configId: string;
  modelId: string;
  showResults: boolean;
  messages: UIMessage[];
  userId: string;
  orgIdStr: string;
}

export async function createChatAgent(context: AgentContext) {
  const { convex, organizationId, configId, modelId, showResults, messages, userId, orgIdStr } = context;

  let config: any;
  const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
  config = allConfigs.find((c: any) => c._id === configId);
  if (!config) {
    config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
  }
  if (!config) throw new Error("No ready database configuration found.");

  let dbConfig: any;
  try {
    dbConfig = { ...JSON.parse(config.encryptedUri), type: config.type };
    if (dbConfig.port) dbConfig.port = parseInt(dbConfig.port, 10);
  } catch {
    throw new Error("Failed to parse database configuration.");
  }

  const [semanticModels, relationships, aiKeys, integrationKeys] = await Promise.all([
    convex.query(api.semanticModels.listModelsByConfig, { configId: config._id }),
    convex.query(api.semanticRelationships.listByConfig, { configId: config._id }),
    convex.query(api.aiKeys.listByOrganization, { organizationId }),
    convex.query(api.integrationKeys.listByOrganization, { organizationId }),
  ]);

  const selectedModelStr = modelId || "gemini:gemini-1.5-flash";
  const aiModel = resolveModel(selectedModelStr, aiKeys, orgIdStr);

  const { loadMcpTools } = (await import("@/lib/mcp-loader")) as any;
  const mcpTools = await loadMcpTools(integrationKeys, orgIdStr);

  let filteredModels = semanticModels;
  if (semanticModels.length > 10) {
    try {
      const lastMessage = (messages[messages.length - 1] as any)?.content || "";
      let embedProvider: "openai" | "gemini" | "local" = (config.memoryProvider as any) || "gemini";

      const { embedding, dimensions } = await convex.action(api.embeddings.generateEmbedding, {
        organizationId: organizationId as any,
        text: lastMessage,
        provider: embedProvider,
      });

      const indexName = dimensions === 1536 ? "by_embedding_1536" :
        dimensions === 1024 ? "by_embedding_1024" : "by_embedding_768";

      const searchResults = await convex.action(api.semanticModels.searchRelatedModels, {
        configId: config._id,
        embedding,
        indexName,
      });

      if (searchResults.length > 0) {
        const matchedIds = new Set(searchResults.map((r: any) => r._id));
        filteredModels = semanticModels.filter((m: any) => matchedIds.has(m._id));
      }
    } catch (err) {
      console.error("[Agent] RAG search failed:", err);
    }
  }

  // 6. Build Prompt
  const schemaDescription = filteredModels.map((model: any) => {
    const fields = model.fields.map((f: any) => {
      let d = `- ${f.displayName} (${f.columnName}): ${f.type}`;
      if (f.expression) d += ` [CALCULATED: ${f.expression}]`;
      if (f.aggregation) d += `, aggregation: ${f.aggregation}`;
      if (f.isPrimary) d += ` (PRIMARY KEY)`;
      return d;
    }).join("\n");
    return `### ${model.displayName} (table: ${model.tableName})\n${fields}`;
  }).join("\n\n");

  const relationshipDescription = relationships?.length > 0
    ? "### Relationships:\n" + relationships.map((rel: any) => {
      const from = semanticModels.find((m: any) => m._id === rel.fromModelId);
      const to = semanticModels.find((m: any) => m._id === rel.toModelId);
      return `- ${from?.tableName ?? "?"}.${rel.fromColumn} → ${to?.tableName ?? "?"}.${rel.toColumn} (${rel.type})`;
    }).join("\n")
    : "";

  const dialectRules = config.type === "mssql"
    ? "- Dialect: T-SQL (SQL Server). Use TOP instead of LIMIT for limiting rows."
    : config.type === "mysql"
      ? "- Dialect: MySQL. Use backticks for reserved names."
      : "- Dialect: PostgreSQL. Use double quotes for reserved names.";

  const systemPrompt = `You are an expert ${config.type.toUpperCase()} Data Analyst.
${schemaDescription}
${relationshipDescription}
Dialect: ${dialectRules}
Limit results to ${MAX_ROWS} rows.

Chart instructions:
- ONLY call render_chart if the user explicitly asks to visualize, chart, graph, or plot the data.
- To render a chart, you MUST use the render_chart tool by providing the SQL query to fetch the data, along with the chart configuration.
- YOU MUST ACTUALLY CALL THE TOOL. DO NOT just generate text claiming the chart was created. The chart will NOT exist unless you successfully invoke the render_chart tool.
- THE FRONTEND AUTOMATICALLY RENDERS THE CHART. DO NOT output markdown image links (e.g. ![chart](...)) or attempt to display the chart yourself in the text.
- Choose the most appropriate chart type:
  - "bar"  → comparisons between categories
  - "line" → trends over time or ordered sequences
  - "area" → cumulative trends
  - "pie"  → proportions / part-of-whole (use only if there are ≤ 8 categories)
- xKey must be the EXACT column name or alias for the X-axis (or pie labels) as returned by your SQL query.
- yKeys must be a COMMA-SEPARATED STRING of EXACT column names or aliases for the Y-axis values as returned by your SQL query (e.g. "revenue, profit"). Use AS aliases in your SQL to ensure clean keys.
- Do NOT call render_chart if the user only asked a data question with no mention of chart/graph/plot/visualize.`;

  // 7. Initialize Agent
  const tools = {
    execute_sql: {
      description: `Executes a SQL SELECT query and returns the result rows.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      }),
      execute: async ({ sql }: { sql: string }) => {
        if (!isSafeSQL(sql)) return { success: false, error: "Unsafe SQL blocked." };
        const rows = await DbExecutor.execute(dbConfig, sql);
        return { success: true, data: rows.slice(0, MAX_ROWS) };
      },
    },
    render_chart: {
      description: `Renders a chart from data. You MUST ACTUALLY CALL THIS TOOL when the user explicitly asks to visualize, chart, graph, or plot data. DO NOT just generate text claiming you created a chart.`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "The SQL query to fetch the data for the chart.",
          },
          chartType: {
            type: "string",
            enum: ["bar", "line", "area", "pie"],
            description: "The type of chart to render.",
          },
          title: {
            type: "string",
            description: "A short descriptive title for the chart.",
          },
          xKey: {
            type: "string",
            description: "The column name to use for the X-axis (or labels in a pie chart).",
          },
          yKeys: {
            type: "string",
            description: "A comma-separated list of column names for the Y-axis values (or value in a pie chart). Example: 'sales, profit'",
          },
        },
        required: ["sql", "chartType", "title", "xKey", "yKeys"],
      }),
      execute: async (input: { sql: string; chartType: string; title: string; xKey: string; yKeys: string }) => {
        if (!isSafeSQL(input.sql)) return { success: false, error: "Unsafe SQL blocked." };
        try {
          const rows = await DbExecutor.execute(dbConfig, input.sql);
          const yKeysArray = input.yKeys.split(",").map(k => k.trim()).filter(Boolean);
          return {
            success: true,
            chartType: input.chartType,
            title: input.title,
            xKey: input.xKey,
            yKeys: yKeysArray,
            data: rows.slice(0, MAX_ROWS),
          };
        } catch (err: any) {
          return { success: false, error: err.message || "Failed to execute SQL for chart." };
        }
      },
    },
    ...mcpTools,
  };

  return new ToolLoopAgent({
    model: aiModel,
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(10),
  });
}
