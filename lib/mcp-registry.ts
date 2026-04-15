 /**
 * MCP Server Registry
 *
 * Maps each integration key (lowercase_underscore) to its MCP server config.
 * URL pattern for Smithery-hosted servers: https://server.smithery.ai/@{qualifiedName}/mcp
 *
 * credentialType:
 *   "bearer"       — single token, sent as Authorization: Bearer <token>
 *   "config_json"  — multiple fields stored as JSON, base64-encoded as ?config= param
 *   "oauth_google" — Google OAuth 2.0 — "Sign in with Google" button, auto-refresh
 *   "oauth"        — generic OAuth (Microsoft/Databox) — not yet implemented, shows info modal
 */

export type ConfigField = {
  key: string;         // JSON key used in the config object
  label: string;       // UI label shown in the modal
  placeholder: string; // placeholder hint
  type?: "text" | "password" | "url";
};

export type McpServerConfig = {
  /** Display name */
  name: string;
  /** Smithery qualified name (used to build the URL) */
  qualifiedName: string;
  /** Full MCP server URL */
  url: string;
  /** How credentials are passed to the server */
  credentialType: "bearer" | "config_json" | "oauth_google" | "oauth";
  /** For oauth_google: Google API scopes required */
  oauthScopes?: string[];
  /** For config_json: the fields to collect */
  configFields?: ConfigField[];
  /** The header/env key the server expects for the API token (bearer only) */
  authHeader?: string;
  /** Transport type */
  transport: "http" | "stdio";
  /** Brief description of what tools this server provides */
  description: string;
};

export const MCP_REGISTRY: Record<string, McpServerConfig> = {
  slack: {
    name: "Slack",
    qualifiedName: "@modelcontextprotocol/server-slack",
    url: "https://server.smithery.ai/@modelcontextprotocol/server-slack/mcp",
    credentialType: "bearer",
    authHeader: "SLACK_BOT_TOKEN",
    transport: "http",
    description: "Send messages, read channels, manage Slack workspaces.",
  },
  gmail: {
    name: "Gmail",
    qualifiedName: "@gongrzhe/server-gmail-autoauth-mcp",
    url: "https://server.smithery.ai/@gongrzhe/server-gmail-autoauth-mcp/mcp",
    credentialType: "oauth_google",
    authHeader: "GMAIL_OAUTH_TOKEN",
    oauthScopes: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    transport: "http",
    description: "Read, search and send Gmail messages via Google OAuth.",
  },
  google_sheets: {
    name: "Google Sheets",
    qualifiedName: "@markuspfundstein/mcp-gsuite",
    url: "https://server.smithery.ai/@markuspfundstein/mcp-gsuite/mcp",
    credentialType: "oauth_google",
    authHeader: "GOOGLE_OAUTH_TOKEN",
    oauthScopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    transport: "http",
    description: "Read and write Google Sheets spreadsheets via Google OAuth.",
  },
  // google_docs: { /* Not yet implemented — coming soon */ },
  google_drive: {
    name: "Google Drive",
    qualifiedName: "@markuspfundstein/mcp-gsuite",
    url: "https://server.smithery.ai/@markuspfundstein/mcp-gsuite/mcp",
    credentialType: "oauth_google",
    authHeader: "GOOGLE_OAUTH_TOKEN",
    oauthScopes: [
      "https://www.googleapis.com/auth/drive",
    ],
    transport: "http",
    description: "Browse and manage Google Drive files via Google OAuth.",
  },
  google_calendar: {
    name: "Google Calendar",
    qualifiedName: "@markuspfundstein/mcp-gsuite",
    url: "https://server.smithery.ai/@markuspfundstein/mcp-gsuite/mcp",
    credentialType: "oauth_google",
    authHeader: "GOOGLE_OAUTH_TOKEN",
    oauthScopes: [
      "https://www.googleapis.com/auth/calendar",
    ],
    transport: "http",
    description: "Create and manage Google Calendar events via Google OAuth.",
  },
  // google_slides: { /* Not yet implemented — coming soon */ },
  // google_search_console: { /* Not yet implemented — coming soon */ },
  // google_analytics: { /* Not yet implemented — coming soon */ },
  airtable: {
    name: "Airtable",
    qualifiedName: "@domdomegg/airtable-mcp-server",
    url: "https://server.smithery.ai/@domdomegg/airtable-mcp-server/mcp",
    credentialType: "bearer",
    authHeader: "AIRTABLE_API_KEY",
    transport: "http",
    description: "Read and write Airtable bases and records.",
  },
  // outlook: { /* Not yet implemented — Microsoft OAuth coming soon */ },
  // microsoft_teams: { /* Not yet implemented — Microsoft OAuth coming soon */ },
  // excel: { /* Not yet implemented — Microsoft OAuth coming soon */ },
  // sharepoint: { /* Not yet implemented — Microsoft OAuth coming soon */ },
  confluence: {
    name: "Confluence",
    qualifiedName: "@sooperset/mcp-atlassian",
    url: "https://server.smithery.ai/@sooperset/mcp-atlassian/mcp",
    credentialType: "config_json",
    configFields: [
      { key: "confluence_url", label: "Confluence URL", placeholder: "https://yourcompany.atlassian.net", type: "url" },
      { key: "confluence_username", label: "Atlassian Email", placeholder: "you@company.com", type: "text" },
      { key: "confluence_api_token", label: "API Token", placeholder: "ATATT...", type: "password" },
    ],
    transport: "http",
    description: "Search, read and create Confluence pages.",
  },
  // databox: { /* Not yet implemented — Databox OAuth coming soon */ },
};

/**
 * Get the MCP server config for a given integration key.
 */
export function getMcpServer(integration: string): McpServerConfig | null {
  return MCP_REGISTRY[integration.toLowerCase()] ?? null;
}

/**
 * Get all registered integration keys.
 */
export function getRegisteredIntegrations(): string[] {
  return Object.keys(MCP_REGISTRY);
}
