"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { KeyManager } from "../lib/key-manager";
import { DbExecutor } from "../lib/db-executor";

function looksLikeEncryptedPayload(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, encryptedHex] = parts;
  const hexRe = /^[0-9a-f]+$/i;
  // AES-256-GCM format used by KeyManager: iv(16 bytes => 32 hex), tag(16 bytes => 32 hex), ciphertext(hex)
  return (
    ivHex.length === 32 &&
    authTagHex.length === 32 &&
    encryptedHex.length > 0 &&
    encryptedHex.length % 2 === 0 &&
    hexRe.test(ivHex) &&
    hexRe.test(authTagHex) &&
    hexRe.test(encryptedHex)
  );
}

/**
 * Securely execute a widget's query using Node.js runtime.
 * This is required for database driver support (mysql, mssql, pg).
 */
export const executeWidgetQuery = action({
  args: {
    widgetId: v.id("dashboardWidgets"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch Widget details via internal query
    const widget: any = await ctx.runQuery(api.bi.getWidgetById, { widgetId: args.widgetId });
    if (!widget || widget.organizationId !== args.organizationId) {
      throw new Error("Unauthorized or widget not found");
    }

    if (!widget.queryId) {
      return { success: true, rows: [], columns: [], message: "No query mapped to this widget." };
    }

    // 2. Resolve Query & Config 
    const savedQuery: any = await ctx.runQuery(api.savedQueries.getById, { queryId: widget.queryId });
    if (!savedQuery) throw new Error("Mapped query not found");

    const config: any = await ctx.runQuery(api.databaseConfigs.getById, { configId: savedQuery.configId });
    if (!config || config.organizationId !== args.organizationId) {
      throw new Error("Target environment configuration not found.");
    }

    // 3. Decrypt + Execute
    try {
      // Support both encrypted storage and legacy plain JSON configs.
      const encryptedUri = String(config.encryptedUri || "");
      const decryptedUri = looksLikeEncryptedPayload(encryptedUri)
        ? KeyManager.decrypt(encryptedUri, String(args.organizationId))
        : encryptedUri;

      const parsedConfig = JSON.parse(decryptedUri);
      const dbConfig = {
        ...parsedConfig,
        type: config.type,
        port: parsedConfig.port ? parseInt(parsedConfig.port, 10) : undefined,
      };
      const host = String(dbConfig.host || "").toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        throw new Error(
          "Database host is set to localhost. BI actions run in Convex's runtime and cannot reach your machine's localhost. Use a network-reachable DB host (or tunnel), then update the environment config."
        );
      }

      // 4. Secure SQL wrapping (engine aware)
      let innerSql = savedQuery.sql.trim().replace(/;?\s*$/, "");
      const isMssql = config.type === "mssql";
      let finalSql = "";

      // We wrap in a subquery to enforce a 1,000 row safety limit for dashboards.
      if (isMssql) {
        if (/ORDER\s+BY/i.test(innerSql) && !/TOP\s+\d+/i.test(innerSql)) {
          innerSql = innerSql.replace(/(\bSELECT\b(\s+DISTINCT)?)/i, "$1 TOP 100 PERCENT ");
        }
        finalSql = `SELECT TOP 1000 * FROM (${innerSql}) AS _bi_source`;
      } else {
        finalSql = `SELECT * FROM (${innerSql}) AS _bi_source LIMIT 1000`;
      }

      // 5. Execute
      const rows = await DbExecutor.execute(dbConfig as any, finalSql);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        success: true,
        rows,
        columns,
        rowCount: rows.length
      };
    } catch (err: any) {
      console.error("[BI Action Error]", err);
      return {
        success: false,
        message: err.message || "Failed to execute dashboard query."
      };
    }
  }
});
