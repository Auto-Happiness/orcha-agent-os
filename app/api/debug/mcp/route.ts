import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { getMcpServer } from "@/lib/mcp-registry";
import { McpClient } from "@/lib/mcp-client";
import { KeyManager } from "@/lib/key-manager";
import { resolveGoogleAccessToken } from "@/lib/google-token-resolver";

/**
 * GET /api/debug/mcp?orgId=xxx
 *
 * Diagnostic endpoint — lists all connected integrations and tests
 * whether their tools (MCP or Direct) can be loaded and called.
 */
export async function GET(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const clerkAuth = await auth();
  const { userId } = clerkAuth;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await clerkAuth.getToken({ template: "convex" });
  if (token) convex.setAuth(token);

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing ?orgId= param" }, { status: 400 });
  }

  const organizationId = orgId as Id<"organizations">;

  let integrationKeys: any[];
  try {
    integrationKeys = await convex.query(api.integrationKeys.listByOrganization, { organizationId });
  } catch (e: any) {
    return NextResponse.json({ error: `Convex error: ${e.message}` }, { status: 500 });
  }

  if (!integrationKeys?.length) {
    return NextResponse.json({ 
      status: "no_integrations",
      message: "No integration keys found." 
    });
  }

  const results: any[] = [];

  for (const key of integrationKeys) {
    const reg = getMcpServer(key.integration);
    const url = reg?.url || key.mcpUrl;

    const entry: any = {
      integration: key.integration,
      strategy: key.integration === "gmail" ? "Direct REST API" : "Smithery MCP",
      status: "untested",
      tools: [],
      error: null,
    };

    try {
      const decryptedKey = key.keyValue !== "none"
        ? KeyManager.decrypt(key.keyValue, orgId)
        : "none";

      if (key.integration === "gmail") {
        // Test Direct Gmail API
        const accessToken = await resolveGoogleAccessToken(decryptedKey);
        const { buildGmailTools } = await import("@/lib/gmail-tools");
        const gmailTools = buildGmailTools(accessToken);
        entry.status = "connected";
        entry.tools = Object.keys(gmailTools);
        
        // Quick verify: try to list profile/labels to see if token is valid
        const verifyRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!verifyRes.ok) {
          entry.status = "token_invalid";
          entry.error = await verifyRes.text();
        }
      } else {
        // Test MCP connection
        if (!url) {
          entry.status = "no_url";
          entry.error = "No URL found.";
        } else {
          const tools = await McpClient.listTools(url, decryptedKey, reg?.authHeader);
          if (tools.length > 0) {
            entry.status = "connected";
            entry.tools = tools.map(t => t.name);
          } else {
            entry.status = "error";
            entry.error = "Got 0 tools from Smithery.";
          }
        }
      }
    } catch (e: any) {
      entry.status = "error";
      entry.error = e.message;
    }

    results.push(entry);
  }

  return NextResponse.json({ 
    summary: { total: results.length, ok: results.filter(r => r.status === "connected").length },
    integrations: results 
  });
}
