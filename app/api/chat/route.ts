import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages, UIMessage, jsonSchema, ToolLoopAgent } from "ai";
import { resolveModel } from "@/lib/model-resolver";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { DbExecutor } from "@/lib/db-executor";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";


const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const clerkAuth = await auth();
    const { userId, orgId: clerkOrgId } = clerkAuth;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, organizationId: rawOrgId, configId: rawConfigId, modelId }: {
      messages: UIMessage[];
      organizationId: string;
      configId: string;
      modelId: string;
    } = await req.json();

    // Keep raw string for encryption/decryption (KeyManager needs plain string)
    const orgIdStr: string = rawOrgId || clerkOrgId || "";
    if (!orgIdStr) {
      return NextResponse.json({ error: "Organization context is missing." }, { status: 400 });
    }

    const organizationId = orgIdStr as Id<"organizations">;
    const configId = rawConfigId as Id<"databaseConfigs"> | undefined;

    console.log(`[Chat API] User=${userId}, Org=${orgIdStr}, Model=${modelId}, Config=${configId}`);

    // Attach Clerk JWT so Convex auth-gated queries work
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // 1. Resolve the database config
    let config: any;
    if (configId) {
      const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
      config = allConfigs.find((c: any) => c._id === configId);
    }
    // Fallback to first ready config if none found
    if (!config) {
      config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
    }

    if (!config) {
      return NextResponse.json({ error: "No ready database configuration found." }, { status: 400 });
    }

    // Parse the connection details from encryptedUri (stored as JSON)
    let dbConfig: any;
    try {
      dbConfig = { ...JSON.parse(config.encryptedUri), type: config.type };
      if (dbConfig.port) dbConfig.port = parseInt(dbConfig.port, 10);
      console.log(`[Chat API] DB config resolved: ${dbConfig.type}://${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    } catch (e) {
      return NextResponse.json({ error: "Failed to parse database configuration." }, { status: 500 });
    }

    // 2. Fetch semantic layer
    const [semanticModels, relationships, aiKeys] = await Promise.all([
      convex.query(api.semanticModels.listModelsByConfig, { configId: config._id }),
      convex.query(api.semanticRelationships.listByConfig, { configId: config._id }),
      convex.query(api.aiKeys.listByOrganization, { organizationId }),
    ]);

    // 3. Initialize the requested model
    const selectedModelStr = modelId || "gemini:gemini-1.5-flash";
    let aiModel: any;
    try {
      aiModel = resolveModel(selectedModelStr, aiKeys, orgIdStr);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    // 4. Build system prompt from semantic layer
    const schemaDescription = semanticModels.map((model: any) => {
      const fields = model.fields.map((f: any) => {
        let fieldDesc = `- ${f.displayName} (${f.columnName}): ${f.type}`;
        if (f.expression) fieldDesc += ` [CALCULATED: ${f.expression}]`;
        if (f.aggregation) fieldDesc += `, aggregation: ${f.aggregation}`;
        if (f.isPrimary) fieldDesc += ` (PRIMARY KEY)`;
        return fieldDesc;
      }).join("\n");
      return `### Table: ${model.displayName} (Physical name: ${model.tableName})\n${fields}`;
    }).join("\n\n");

    const relationshipDescription = relationships?.length > 0
      ? "### Relationships (JOIN Paths):\n" + relationships.map((rel: any) => {
          const from = semanticModels.find((m: any) => m._id === rel.fromModelId);
          const to = semanticModels.find((m: any) => m._id === rel.toModelId);
          return `- ${rel.fromColumn} in ${from?.tableName ?? "unknown"} → ${rel.toColumn} in ${to?.tableName ?? "unknown"} (${rel.type})`;
        }).join("\n")
      : "";

    const systemPrompt = `You are an expert Data Analyst specializing in ${config.type.toUpperCase()} SQL.
            Your goal is to answer the user's data questions by generating and executing SQL queries.

            Use the following Semantic Layer to understand the database:
            ${schemaDescription}

            ${relationshipDescription}

            Rules:
            1. Use physical table and column names in your SQL.
            2. Use the JOIN paths defined above when joining tables.
            3. For calculated fields, use the expression as the source of truth.
            4. Always use the "execute_sql" tool to run queries — never just show SQL without executing it.
            5. Ensure SQL is compatible with ${config.type.toUpperCase()}.
            6. If a question is ambiguous or impossible, explain why.`;

          // 5. Stream response with tool loop (auto-continues after tool calls)
          const tools = {
            execute_sql: {
              description: "Executes a SQL query against the connected database and returns the results.",
              inputSchema: jsonSchema({
                type: "object",
                properties: {
                  sql: { type: "string", description: "The SQL query to execute." },
                },
                required: ["sql"],
              }),
              execute: async ({ sql }: { sql: string }): Promise<{ success: boolean; data?: any[]; error?: string }> => {
                console.log(`[Chat API] Executing SQL:\n${sql}`);
                try {
                  const rows = await DbExecutor.execute(dbConfig, sql);
                  console.log(`[Chat API] SQL returned ${rows.length} rows`);
                  return { success: true, data: rows };
                } catch (err: any) {
                  console.error(`[Chat API] SQL execution failed:`, err.message);
                  return { success: false, error: err.message };
                }
              },
            },
          } as any;

          const agent = new ToolLoopAgent({
            model: aiModel,
            instructions: systemPrompt,
            tools,
          });

          const result = await agent.stream({
            messages: await convertToModelMessages(messages),
          });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
