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
    const { resolveGoogleAccessToken } = await import("@/lib/google-token-resolver");

    for (const key of (integrationKeys as any[])) {
      const regConfig = mcpRegistry.getMcpServer(key.integration);

      try {
        const decryptedKey = key.keyValue !== "none"
          ? KeyManager.decrypt(key.keyValue, orgIdStr)
          : "none";

        // ── GMAIL: Direct Gmail REST API (Smithery server needs local process) ──
        if (key.integration === "gmail") {
          const accessToken = await resolveGoogleAccessToken(decryptedKey);
          const { buildGmailTools } = await import("@/lib/gmail-tools");
          const gmailTools = buildGmailTools(accessToken);
          for (const [name, tool] of Object.entries(gmailTools)) {
            mcpTools[name] = {
              description: tool.description,
              inputSchema: jsonSchema(tool.parameters as any),
              execute: tool.execute,
            };
          }
          console.log(`[Chat] Loaded ${Object.keys(gmailTools).length} Gmail tools (direct API)`);
          continue;
        }

        // ── GOOGLE CALENDAR: Direct Calendar REST API ──
        if (key.integration === "google_calendar") {
          const accessToken = await resolveGoogleAccessToken(decryptedKey);
          const { buildGoogleCalendarTools } = await import("@/lib/google-calendar-tools");
          const calTools = buildGoogleCalendarTools(accessToken);
          for (const [name, tool] of Object.entries(calTools)) {
            mcpTools[name] = {
              description: tool.description,
              inputSchema: jsonSchema(tool.parameters as any),
              execute: tool.execute,
            };
          }
          console.log(`[Chat] Loaded ${Object.keys(calTools).length} Google Calendar tools (direct API)`);
          continue;
        }

        // ── GOOGLE SHEETS: Direct Sheets REST API ──
        if (key.integration === "google_sheets") {
          const accessToken = await resolveGoogleAccessToken(decryptedKey);
          const { buildGoogleSheetsTools } = await import("@/lib/google-sheets-tools");
          const sheetsTools = buildGoogleSheetsTools(accessToken);
          for (const [name, tool] of Object.entries(sheetsTools)) {
            mcpTools[name] = {
              description: tool.description,
              inputSchema: jsonSchema(tool.parameters as any),
              execute: tool.execute,
            };
          }
          console.log(`[Chat] Loaded ${Object.keys(sheetsTools).length} Google Sheets tools (direct API)`);
          continue;
        }

        // ── GOOGLE DRIVE: Direct Drive REST API ──
        if (key.integration === "google_drive") {
          const accessToken = await resolveGoogleAccessToken(decryptedKey);
          const { buildGoogleDriveTools } = await import("@/lib/google-drive-tools");
          const driveTools = buildGoogleDriveTools(accessToken);
          for (const [name, tool] of Object.entries(driveTools)) {
            mcpTools[name] = {
              description: tool.description,
              inputSchema: jsonSchema(tool.parameters as any),
              execute: tool.execute,
            };
          }
          console.log(`[Chat] Loaded ${Object.keys(driveTools).length} Google Drive tools (direct API)`);
          continue;
        }

        // ── ALL OTHER INTEGRATIONS: Smithery MCP HTTP ──
        const url = regConfig?.url || key.mcpUrl;
        if (!url) continue;

        const tools = await McpClient.listTools(url, decryptedKey, regConfig?.authHeader);
        for (const tool of (tools as any[])) {
          const namespacedName = `${key.integration}_${tool.name}`;
          mcpTools[namespacedName] = {
            description: `[${key.integration}] ${tool.description || ""}`,
            inputSchema: jsonSchema(tool.inputSchema as any),
            execute: async (args: any) => {
              console.log(`[Chat] Calling MCP tool: ${namespacedName}`);
              return await McpClient.callTool(url, tool.name, args, decryptedKey, regConfig?.authHeader);
            }
          };
        }
      } catch (e: any) {
        console.warn(`[Chat] Failed to load tools for ${key.integration}:`, e.message);
      }
    }

    // 5. RAG: Vector Search for relevant tables (Scaling for 1,000+ tables)
    let filteredModels = semanticModels;
    if (semanticModels.length > 10) {
      console.log(`[Chat] Large schema detected (${semanticModels.length} tables). Performing RAG...`);
      try {
        const lastMessage = (messages[messages.length - 1] as any)?.content || "";
        
        // Auto-resolve embedding provider based on modelId prefix
        let embedProvider: "openai" | "gemini" | "local" = "gemini";
        if (selectedModelStr.startsWith("openai")) embedProvider = "openai";
        else if (selectedModelStr.startsWith("ollama")) embedProvider = "local";
        
        // Fallback for providers without embeddings (Claude/Grok)
        if (selectedModelStr.startsWith("claude") || selectedModelStr.startsWith("grok")) {
           const hasOpenAI = aiKeys.some(k => k.provider === "openai");
           embedProvider = hasOpenAI ? "openai" : "gemini";
        }

        const { embedding, dimensions } = await convex.action(api.embeddings.generateEmbedding, {
          organizationId: organizationId,
          text: lastMessage,
          provider: embedProvider,
        });

        // Search in the correct vector index
        const indexName = dimensions === 1536 ? "by_embedding_1536" : 
                         dimensions === 1024 ? "by_embedding_1024" : "by_embedding_768";
        
        const searchResults = await convex.action(api.semanticModels.searchRelatedModels, {
          configId: config._id,
          embedding,
          indexName,
        });

        if (searchResults.length > 0) {
          const matchedIds = new Set(searchResults.map(r => r._id));
          filteredModels = semanticModels.filter((m: any) => matchedIds.has(m._id));
          console.log(`[Chat] RAG narrowed ${semanticModels.length} tables down to ${filteredModels.length}`);
        }
      } catch (err) {
        console.error("[Chat] RAG search failed, falling back to full schema:", err);
      }
    }

    // 6. Build system prompt
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
      ? "- Dialect: T-SQL (SQL Server). Use TOP instead of LIMIT for limiting rows. Use [schema].[table] if necessary."
      : config.type === "mysql"
        ? "- Dialect: MySQL. Use backticks for reserved names. Use LIMIT for limiting rows."
        : "- Dialect: PostgreSQL. Use double quotes for reserved names. Use LIMIT for limiting rows.";

    const systemPrompt = `You are an expert ${config.type.toUpperCase()} Data Analyst and Operations Agent.
Answer data questions using the execute_sql tool, and perform operational actions (like sending messages or updating spreadsheets) using the provided integration tools.

${schemaDescription}

${relationshipDescription}

Integration Tools:
${Object.keys(mcpTools).length > 0 ? "You have access to the following external integration tools. Use them to perform operational actions:\n" + Object.keys(mcpTools).map(t => `- ${t}`).join("\n") : "No external integrations connected."}

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
          type: "object" as const,
          properties: {
            sql: { type: "string" as const, description: "The SQL query to execute." },
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
