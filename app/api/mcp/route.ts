import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { DbExecutor, DbConfig } from "@/lib/db-executor";

interface McpToolParameter {
  name: string;
  type: string;
  description: string;
}

interface McpTool {
  name: string;
  description: string;
  parameters: McpToolParameter[];
  statement: string;
}


// Initialize Convex Client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Helper to decrypt/resolve DB config (mocking for now, will integrate with your encryption logic)
async function getDbConfig(orgId: string): Promise<DbConfig | null> {
  try {
    const config: any = await convex.query(api.databaseConfigs.getByOrganization, {
      organizationId: orgId as any
    });
    if (!config) return null;

    // For this demo, we're storing the config as a JSON string in encryptedUri
    // In Production, this would be encrypted with a KMS or Organization Key.
    const rawConfig = JSON.parse(config.encryptedUri);

    return {
      type: config.type,
      host: rawConfig.host,
      port: parseInt(rawConfig.port),
      user: rawConfig.user,
      password: rawConfig.password,
      database: rawConfig.database,
      ssl: !!rawConfig.ssl,
    };
  } catch (e) {
    console.error("Error fetching DB config:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = getAuth(req);

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbConfig = await getDbConfig(orgId);
  const body = await req.json();
  const { method, params, id } = body;

  // Graceful handling for first-initialization (no DB connected yet)
  if (!dbConfig) {
    if (method === "listTools") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: [] } // Server is UP, but has 0 tools
      });
    }
    // For callTool, we return a clarifying error
    if (method === "callTool") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { 
          code: -32603, 
          message: "Database not connected. Please visit the /configure page to initialize your environment." 
        }
      });
    }
  }

  try {
    switch (method) {
      case "listTools":
        const tools = await convex.query(api.mcpTools.listByOrganization, {
          organizationId: orgId as any
        });

        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: (tools as McpTool[]).map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: {
                type: "object",
                properties: t.parameters.reduce((acc: Record<string, any>, p) => {
                  acc[p.name] = { type: p.type, description: p.description };
                  return acc;
                }, {}),
                required: t.parameters.map((p) => p.name)
              }
            }))
          }
        });

      case "callTool":
        const toolName = params.name;
        const args = params.arguments;

        const tool: McpTool | undefined = await convex.query(api.mcpTools.listByOrganization, {
          organizationId: orgId as any
        }).then((list: any) => (list as McpTool[]).find((t) => t.name === toolName));

        if (!tool) {
          throw new Error(`Tool ${toolName} not found`);
        }

        const orderedParams = tool.parameters.map((p: any) => args[p.name]);
        if (!dbConfig) throw new Error("Database not connected");
        
        const rows = await DbExecutor.execute(dbConfig, tool.statement, orderedParams);

        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(rows, null, 2)
              }
            ]
          }
        });

      default:
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" }
        });
    }
  } catch (error: any) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: error.message }
    });
  }
}
