import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";

// Polyfill EventSource for Node.js environment
if (typeof global !== 'undefined' && !(global as any).EventSource) {
  (global as any).EventSource = EventSource as any;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

/**
 * For Google OAuth tokens stored as JSON:
 * { access_token, refresh_token, expires_at }
 */
async function resolveGoogleToken(credential: string): Promise<string> {
  const { access_token, refresh_token, expires_at } = JSON.parse(credential);

  if (expires_at && Date.now() < expires_at) {
    return access_token;
  }

  if (!refresh_token) {
    throw new Error("Google OAuth token expired and no refresh_token available. Please reconnect.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Builds the final URL for a Smithery-hosted MCP server.
 * - For config_json: encodes and appends as ?config=
 * - For bearer/oauth_google with an authHeader: wraps token in JSON as ?config=
 */
function buildUrl(baseUrl: string, credential: string, authHeader?: string): string {
  if (!credential || credential === "none") return baseUrl;

  let configPayload: Record<string, any> | null = null;

  // 1. Check if it's already a JSON config (e.g. Confluence)
  if (credential.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(credential);
      // Skip if it's a Google OAuth blob (those are resolved to strings before reaching here)
      if (!("access_token" in parsed)) {
        configPayload = parsed;
      }
    } catch {
      // Ignored
    }
  }

  // 2. If we have an authHeader and a plain string credential (resolved token),
  // wrap it into a config object for Smithery to inject as an environment variable.
  if (!configPayload && authHeader && !credential.trim().startsWith("{")) {
    configPayload = { [authHeader]: credential };
  }

  if (configPayload) {
    const encoded = Buffer.from(JSON.stringify(configPayload)).toString("base64");
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}config=${encoded}`;
  }

  return baseUrl;
}

export class McpClient {
  /**
   * Fetches the available tools from an MCP server.
   */
  static async listTools(url: string, credential?: string, authHeader?: string): Promise<McpTool[]> {
    // 1. Handle SSE transport if URL indicates it (Native MCP servers)
    if (url.toLowerCase().includes("/sse")) {
      try {
        console.log(`[McpClient] Connecting to SSE server at ${url}...`);
        const transport = new SSEClientTransport(new URL(url));
        const client = new Client(
          { name: "OrchaAgent", version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        const result = await client.listTools();
        await client.close();

        return (result.tools as any[]) || [];
      } catch (e: any) {
        console.error(`[McpClient] SSE listTools failed at ${url}:`, e.message);
        return [];
      }
    }

    // 2. Fallback to Stateless HTTP (Smithery-style)
    let resolvedToken = credential || "";

    if (resolvedToken.trim().startsWith("{") && resolvedToken.includes("access_token")) {
      try {
        resolvedToken = await resolveGoogleToken(resolvedToken);
      } catch (e: any) {
        console.warn(`[McpClient] Google token resolution failed: ${e.message}`);
        return [];
      }
    }

    const finalUrl = buildUrl(url, resolvedToken, authHeader);
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const isEncodedInUrl = finalUrl.includes("config=");
    if (resolvedToken && resolvedToken !== "none" && !isEncodedInUrl) {
      headers["Authorization"] = `Bearer ${resolvedToken}`;
      headers["X-API-Key"] = resolvedToken;
    }

    try {
      const res = await fetch(finalUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", params: {}, id: Date.now() }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[McpClient] listTools failed (${res.status}) at ${finalUrl.split('?')[0]}: ${text.slice(0, 200)}`);
        return [];
      }

      const data = await res.json();
      return data.result?.tools || [];
    } catch (e: any) {
      console.error(`[McpClient] Error listing tools at ${url}:`, e.message);
      return [];
    }
  }

  /**
   * Calls a specific tool on an MCP server.
   */
  static async callTool(url: string, toolName: string, args: any, credential?: string, authHeader?: string): Promise<any> {
    // 1. Handle SSE transport if URL indicates it (Native MCP servers)
    if (url.toLowerCase().includes("/sse")) {
      try {
        const transport = new SSEClientTransport(new URL(url));
        const client = new Client(
          { name: "OrchaAgent", version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });
        await client.close();
        return result;
      } catch (e: any) {
        console.error(`[McpClient] SSE callTool failed at ${url}:`, e.message);
        throw e;
      }
    }

    // 2. Fallback to Stateless HTTP (Smithery-style)
    let resolvedToken = credential || "";

    if (resolvedToken.trim().startsWith("{") && resolvedToken.includes("access_token")) {
      resolvedToken = await resolveGoogleToken(resolvedToken);
    }

    const finalUrl = buildUrl(url, resolvedToken, authHeader);
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const isEncodedInUrl = finalUrl.includes("config=");
    if (resolvedToken && resolvedToken !== "none" && !isEncodedInUrl) {
      headers["Authorization"] = `Bearer ${resolvedToken}`;
      headers["X-API-Key"] = resolvedToken;
    }

    const res = await fetch(finalUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: args },
        id: Date.now(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP tools/call failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    return data.result;
  }
}

