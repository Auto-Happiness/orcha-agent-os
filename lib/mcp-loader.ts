import { jsonSchema } from "ai";

/**
 * Shared utility to load MCP tools for both direct API (Next.js) and Background Workers.
 */
export async function loadMcpTools(integrationKeys: any[], orgIdStr: string) {
  const mcpTools: Record<string, any> = {};
  const mcpRegistry = await import("@/lib/mcp-registry");
  const { McpClient } = await import("@/lib/mcp-client");
  const { KeyManager } = await import("@/lib/key-manager");
  const { resolveGoogleAccessToken } = await import("@/lib/google-token-resolver");

  for (const key of integrationKeys) {
    const regConfig = mcpRegistry.getMcpServer(key.integration);
    try {
      const decryptedKey = key.keyValue !== "none"
        ? (key.storageStrategy === "convex" || !key.storageStrategy ? KeyManager.decrypt(key.keyValue, orgIdStr) : key.keyValue)
        : "none";

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
        continue;
      }

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
        continue;
      }

      // ── Custom MCP servers ────────────────────────────────────────────
      // keyValue is stored as JSON: { url: string, token: string }
      // These are never in the registry, so regConfig is null.
      if (key.keyType === "custom_mcp") {
        let parsedConfig: { url?: string; token?: string } = {};
        try {
          parsedConfig = JSON.parse(decryptedKey);
        } catch {
          console.warn(`[MCP Loader] Could not parse custom_mcp config for ${key.integration}`);
          continue;
        }
        const customUrl = parsedConfig.url || key.mcpUrl;
        const customToken = parsedConfig.token || "";
        console.log(`[MCP Loader] Custom MCP "${key.integration}" → url=${customUrl} hasToken=${!!customToken}`);
        if (!customUrl) continue;

        const tools = await McpClient.listTools(customUrl, customToken, undefined, true);
        console.log(`[MCP Loader] Custom MCP "${key.integration}" discovered ${tools.length} tools: ${tools.map((t: any) => t.name).join(", ") || "(none)"}`);
        for (const tool of (tools as any[])) {
          const namespacedName = `${key.integration}_${tool.name}`;
          mcpTools[namespacedName] = {
            description: `[${key.integration}] ${tool.description || ""}`,
            inputSchema: jsonSchema(tool.inputSchema as any),
            execute: async (args: any) => {
              return await McpClient.callTool(customUrl, tool.name, args, customToken, undefined, true);
            }
          };
        }
        continue;
      }
      // ── Registry-backed MCP servers ───────────────────────────────────

      const url = regConfig?.url || key.mcpUrl;
      if (!url) continue;

      const tools = await McpClient.listTools(url, decryptedKey, regConfig?.authHeader);
      for (const tool of (tools as any[])) {
        const namespacedName = `${key.integration}_${tool.name}`;
        mcpTools[namespacedName] = {
          description: `[${key.integration}] ${tool.description || ""}`,
          inputSchema: jsonSchema(tool.inputSchema as any),
          execute: async (args: any) => {
            return await McpClient.callTool(url, tool.name, args, decryptedKey, regConfig?.authHeader);
          }
        };
      }
    } catch (e: any) {
      console.warn(`[MCP Loader] Failed for ${key.integration}:`, e.message);
    }
  }
  return mcpTools;
}
