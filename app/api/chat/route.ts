import { NextRequest, NextResponse } from "next/server";
import { convertToModelMessages, UIMessage, jsonSchema, ToolLoopAgent, stepCountIs } from "ai";
import { resolveModel } from "@/lib/model-resolver";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { DbExecutor } from "@/lib/db-executor";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";

// Hard limit on rows returned per query — prevents LLM context overflow
const MAX_ROWS = 50;

// Allowlist of SQL statement prefixes the agent is permitted to run
const ALLOWED_SQL_PREFIXES = ["select", "show", "describe", "explain", "with"];

function isSafeSQL(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  return ALLOWED_SQL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export async function POST(req: NextRequest) {
  // Per-request Convex client — avoids shared auth state across concurrent requests
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    const clerkAuth = await auth();
    const { userId, orgId: clerkOrgId } = clerkAuth;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, organizationId: rawOrgId, configId: rawConfigId, modelId, showResults = true }: {
      messages: UIMessage[];
      organizationId: string;
      configId: string;
      modelId: string;
      showResults: boolean;
    } = await req.json();

    const orgIdStr: string = rawOrgId || clerkOrgId || "";
    if (!orgIdStr) {
      return NextResponse.json({ error: "Organization context is missing." }, { status: 400 });
    }

    const organizationId = orgIdStr as Id<"organizations">;
    const configId = rawConfigId as Id<"databaseConfigs"> | undefined;

    console.log(`[Chat] User=${userId} Org=${orgIdStr} Model=${modelId} Config=${configId}`);

    // Attach Clerk JWT so Convex auth-gated queries work
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // 1. Resolve DB config — fetch specific if provided, fallback to first ready
    let config: any;
    if (configId) {
      const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
      config = allConfigs.find((c: any) => c._id === configId);
    }
    if (!config) {
      config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
    }
    if (!config) {
      return NextResponse.json({ error: "No ready database configuration found." }, { status: 400 });
    }

    // Parse connection details — encryptedUri stores JSON (name is legacy)
    let dbConfig: any;
    try {
      dbConfig = { ...JSON.parse(config.encryptedUri), type: config.type };
      if (dbConfig.port) dbConfig.port = parseInt(dbConfig.port, 10);
    } catch {
      return NextResponse.json({ error: "Failed to parse database configuration." }, { status: 500 });
    }

    // 2. Fetch semantic layer + AI keys + Integration keys in parallel
    const [semanticModels, relationships, aiKeys, integrationKeys] = await Promise.all([
      convex.query(api.semanticModels.listModelsByConfig, { configId: config._id }),
      convex.query(api.semanticRelationships.listByConfig, { configId: config._id }),
      convex.query(api.aiKeys.listByOrganization, { organizationId }),
      convex.query(api.integrationKeys.listByOrganization, { organizationId }),
    ]);

    // 3. Resolve AI model from stored keys
    const selectedModelStr = modelId || "gemini:gemini-1.5-flash";
    let aiModel: any;
    try {
      aiModel = resolveModel(selectedModelStr, aiKeys, orgIdStr);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    // 4. Resolve and Load MCP Tools
    const mcpTools: Record<string, any> = {};
    const mcpRegistry = await import("@/lib/mcp-registry");
    const { McpClient } = await import("@/lib/mcp-client");
    const { KeyManager } = await import("@/lib/key-manager");

    for (const key of (integrationKeys as any[])) {
      let config = mcpRegistry.getMcpServer(key.integration);
      const url = config?.url || key.mcpUrl;
      if (!url) continue;

      try {
        // Decrypt the integration key
        const decryptedKey = key.keyValue !== "none"
          ? KeyManager.decrypt(key.keyValue, orgIdStr)
          : "none";

        // Fetch tools from the MCP server
        const tools = await McpClient.listTools(url, decryptedKey);

        for (const tool of tools) {
          // Prefix to avoid collisions and make it clear which service is being used
          const namespacedName = `${key.integration}_${tool.name}`;
          mcpTools[namespacedName] = {
            description: `[${key.integration}] ${tool.description || ""}`,
            inputSchema: jsonSchema(tool.inputSchema),
            execute: async (args: any) => {
              console.log(`[Chat] Calling MCP tool: ${namespacedName}`);
              const result = await McpClient.callTool(url, tool.name, args, decryptedKey);
              return result;
            }
          };
        }
      } catch (e: any) {
        console.warn(`[Chat] Failed to load MCP tools for ${key.integration}:`, e.message);
      }
    }

    // 5. Build system prompt
    const schemaDescription = semanticModels.map((model: any) => {
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
      ? "- Dialect: T-SQL (SQL Server). Use TOP instead of LIMIT for limiting rows. Use [schema].[table] if necessary."
      : config.type === "mysql"
        ? "- Dialect: MySQL. Use backticks for reserved names. Use LIMIT for limiting rows."
        : "- Dialect: PostgreSQL. Use double quotes for reserved names. Use LIMIT for limiting rows.";

    const systemPrompt = `You are an expert ${config.type.toUpperCase()} Data Analyst and Operations Agent.
Answer data questions using the execute_sql tool, and perform operational actions (like sending messages or updating spreadsheets) using the provided integration tools.

${schemaDescription}

${relationshipDescription}

Integration Tools:
${Object.keys(mcpTools).length > 0 ? "You have access to external integrations. Tool names are prefixed with the service name (e.g. slack_send_message)." : "No integrations connected."}

Dialect Instructions:
${dialectRules}

Rules:
- Use physical table/column names from the schema above.
- Only generate SELECT, SHOW, DESCRIBE, EXPLAIN, or WITH queries. Never mutate data.
- Always execute queries with the tool — never just show SQL.
- Limit results to ${MAX_ROWS} rows unless the user asks for more.
${!showResults ? "- The user has disabled result tables. After executing the query, summarize the findings in plain text only — do not describe the raw data rows." : ""}
- If a question is ambiguous or impossible, explain why concisely.`;

    // 6. Stream with ToolLoopAgent
    const tools = {
      execute_sql: {
        description: `Executes a read-only SQL query. Returns up to ${MAX_ROWS} rows.`,
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            sql: { type: "string", description: "The SQL query to execute." },
          },
          required: ["sql"],
        }),
        execute: async ({ sql }: { sql: string }): Promise<{ success: boolean; data?: any[]; error?: string }> => {
          // Safety: block any non-SELECT statements
          if (!isSafeSQL(sql)) {
            console.warn(`[Chat] Blocked unsafe SQL: ${sql.substring(0, 80)}`);
            return { success: false, error: "Only read-only queries (SELECT, SHOW, DESCRIBE) are permitted." };
          }

          console.log(`[Chat] SQL: ${sql.replace(/\s+/g, " ").substring(0, 120)}`);
          try {
            const rows = await DbExecutor.execute(dbConfig, sql);
            const truncated = rows.slice(0, MAX_ROWS);
            console.log(`[Chat] Returned ${truncated.length}/${rows.length} rows`);
            return { success: true, data: truncated };
          } catch (err: any) {
            console.error(`[Chat] SQL failed: ${err.message}`);
            return { success: false, error: err.message };
          }
        },
      },
      ...mcpTools,
    } as any;

    const agent = new ToolLoopAgent({
      model: aiModel,
      instructions: systemPrompt,
      tools,
      stopWhen: stepCountIs(10), // allow multi-step: SQL → format → send email
    });

    const result = await agent.stream({
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("[Chat] Unhandled error:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
