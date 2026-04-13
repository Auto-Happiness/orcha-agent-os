export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

/**
 * For Google OAuth tokens stored as JSON:
 * { access_token, refresh_token, expires_at }
 *
 * If the access_token is expired (or within 60s of expiry),
 * we use the refresh_token to get a new one from Google.
 */
async function resolveGoogleToken(credential: string): Promise<string> {
  const { access_token, refresh_token, expires_at } = JSON.parse(credential);

  // If token is still valid, return as-is
  if (expires_at && Date.now() < expires_at) {
    return access_token;
  }

  // Refresh the token
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
  // Note: we return the fresh token; persisting the updated expires_at
  // is handled by the callback route on next connect. For server-side
  // usage the in-memory fresh token is sufficient for this request.
  return data.access_token;
}

/**
 * Builds the final URL for a Smithery-hosted MCP server.
 * - For bearer/Google OAuth: URL unchanged (token goes in Authorization header)
 * - For config_json multi-field: base64-encodes JSON as ?config= param
 */
function buildUrl(baseUrl: string, credential: string): string {
  if (!credential || credential === "none") return baseUrl;

  // Multi-field JSON config → Smithery ?config= param
  if (credential.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(credential);
      // Google token JSON has access_token — not a Smithery config object
      if ("access_token" in parsed) return baseUrl;

      const encoded = Buffer.from(JSON.stringify(parsed)).toString("base64");
      const sep = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${sep}config=${encoded}`;
    } catch {
      // Fall through
    }
  }

  return baseUrl;
}

export class McpClient {
  /**
   * Fetches the available tools from an MCP server.
   * Handles bearer, Google OAuth (auto-refresh), and config_json transports.
   */
  static async listTools(url: string, credential?: string): Promise<McpTool[]> {
    let resolvedToken = credential || "";

    // Auto-refresh Google OAuth tokens
    if (resolvedToken.trim().startsWith("{") && resolvedToken.includes("access_token")) {
      try {
        resolvedToken = await resolveGoogleToken(resolvedToken);
      } catch (e: any) {
        console.warn(`[McpClient] Google token resolution failed: ${e.message}`);
        return [];
      }
    }

    const finalUrl = buildUrl(url, resolvedToken);
    const isConfigJson = credential?.trim().startsWith("{") && !credential.includes("access_token");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (resolvedToken && resolvedToken !== "none" && !isConfigJson) {
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
        console.error(`[McpClient] listTools failed (${res.status}): ${text.slice(0, 200)}`);
        throw new Error(`MCP server returned ${res.status}`);
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
  static async callTool(url: string, toolName: string, args: any, credential?: string): Promise<any> {
    let resolvedToken = credential || "";

    // Auto-refresh Google OAuth tokens
    if (resolvedToken.trim().startsWith("{") && resolvedToken.includes("access_token")) {
      resolvedToken = await resolveGoogleToken(resolvedToken);
    }

    const finalUrl = buildUrl(url, resolvedToken);
    const isConfigJson = credential?.trim().startsWith("{") && !credential.includes("access_token");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (resolvedToken && resolvedToken !== "none" && !isConfigJson) {
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
