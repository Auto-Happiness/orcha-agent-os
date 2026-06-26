// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";
import { getMcpServer } from "@/lib/mcp-registry";
import { McpClient } from "@/lib/mcp-client";
import { Id } from "@/convex/_generated/dataModel";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

export async function POST(req: NextRequest) {
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const convex = getConvexClient();
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    const body = await req.json();
    const { method, params, id, integration, organizationId } = body;

    if (!integration || !organizationId) {
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32600, message: "integration and organizationId are required." } });
    }

    const keyRecord = await convex.query(api.integrationKeys.getByIntegration, {
      organizationId: organizationId as Id<"organizations">,
      integration,
    });

    if (!keyRecord) {
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32603, message: `Integration '${integration}' is not connected. Visit the Marketplace to connect it.` } });
    }

    let apiToken: string;
    try {
      apiToken = keyRecord.storageStrategy === "convex"
        ? KeyManager.decrypt(keyRecord.keyValue, organizationId)
        : keyRecord.keyValue;
    } catch (e) {
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32603, message: "Failed to decrypt integration token." } });
    }

    let mcpUrl: string;
    let bearerToken: string = apiToken;

    if (keyRecord.keyType === "custom_mcp") {
      try {
        const parsed = JSON.parse(apiToken);
        mcpUrl = parsed.url;
        bearerToken = parsed.token ?? "";
      } catch {
        return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32603, message: "Invalid custom MCP config." } });
      }
    } else {
      const registryEntry = getMcpServer(integration);
      mcpUrl = keyRecord.mcpUrl ?? registryEntry?.url ?? "";

      if (!mcpUrl) {
        return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32603, message: `No MCP server URL found for '${integration}'.` } });
      }
    }

    console.log(`[MCP Proxy] ${method} → ${mcpUrl} (integration: ${integration})`);

    const isSse = mcpUrl.toLowerCase().includes("/sse");
    const isCustom = keyRecord.keyType === "custom_mcp";
    const useCustomHttp = isCustom && !isSse;

    if (method === "tools/list") {
      const tools = await McpClient.listTools(mcpUrl, bearerToken, undefined, useCustomHttp);
      return NextResponse.json({ jsonrpc: "2.0", id, result: { tools } });
    }

    if (method === "tools/call") {
      const result = await McpClient.callTool(
        mcpUrl,
        params.name,
        params.arguments || {},
        bearerToken,
        undefined,
        useCustomHttp
      );
      return NextResponse.json({ jsonrpc: "2.0", id, result });
    }

    // Fallback for other methods (simple proxy)
    const upstream = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error(`[MCP Proxy] Upstream error ${upstream.status}: ${text}`);
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32603, message: `Upstream MCP server returned ${upstream.status}.` } });
    }

    const result = await upstream.json();
    return NextResponse.json(result);

  } catch (err: any) {
    console.error("[MCP Proxy] Error:", err.message);
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: err.message } });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const integration = searchParams.get("integration");
  const organizationId = searchParams.get("organizationId");

  if (!integration || !organizationId) {
    return NextResponse.json({ error: "integration and organizationId are required." }, { status: 400 });
  }

  const syntheticReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...Object.fromEntries(req.headers) },
    body: JSON.stringify({ method: "tools/list", params: {}, id: 1, integration, organizationId }),
  });

  return POST(new NextRequest(syntheticReq));
}
