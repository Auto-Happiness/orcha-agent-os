"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { KeyManager } from "../lib/key-manager";
import { DbExecutor } from "../lib/db-executor";

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

    // 3. Decrypt Credentials
    const keyManager = new KeyManager();
    const decryptedUri = await keyManager.decrypt(config.encryptedUri);
    const dbConfig = JSON.parse(decryptedUri);

    // 4. Secure SQL Wrapping (Engine Aware)
    let innerSql = savedQuery.sql.trim().replace(/;?\s*$/, "");
    const isMssql = config.type === "mssql";
    let finalSql = "";

    // We wrap in a subquery to enforce a 1,000 row safety limit for dashboards
    if (isMssql) {
      if (/ORDER\s+BY/i.test(innerSql) && !/TOP\s+\d+/i.test(innerSql)) {
        innerSql = innerSql.replace(/(\bSELECT\b(\s+DISTINCT)?)/i, "$1 TOP 100 PERCENT ");
      }
      finalSql = `SELECT TOP 1000 * FROM (${innerSql}) AS _bi_source`;
    } else {
      finalSql = `SELECT * FROM (${innerSql}) AS _bi_source LIMIT 1000`;
    }

    // 5. Execute
    try {
      const executor = new DbExecutor(config.type, dbConfig);
      const rows = await executor.execute(finalSql);
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
