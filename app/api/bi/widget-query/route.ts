import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";
import { DbExecutor } from "@/lib/db-executor";

function looksLikeEncryptedPayload(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, encryptedHex] = parts;
  const hexRe = /^[0-9a-f]+$/i;
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

export async function POST(req: NextRequest) {
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = await clerkAuth.getToken({ template: "convex" });
    const { widgetId, organizationId } = await req.json();
    if (!widgetId || !organizationId) {
      return NextResponse.json({ success: false, message: "widgetId and organizationId are required." }, { status: 400 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (token) convex.setAuth(token);

    const widget: any = await convex.query(api.bi.getWidgetById, { widgetId });
    if (!widget || String(widget.organizationId) !== String(organizationId)) {
      return NextResponse.json({ success: false, message: "Unauthorized or widget not found." }, { status: 404 });
    }
    if (!widget.queryId) {
      return NextResponse.json({ success: true, rows: [], columns: [], rowCount: 0 });
    }

    const savedQuery: any = await convex.query(api.savedQueries.getById, { queryId: widget.queryId });
    if (!savedQuery) {
      return NextResponse.json({ success: false, message: "Mapped query not found." }, { status: 404 });
    }

    const config: any = await convex.query(api.databaseConfigs.getById, { configId: savedQuery.configId });
    if (!config || String(config.organizationId) !== String(organizationId)) {
      return NextResponse.json({ success: false, message: "Target environment configuration not found." }, { status: 404 });
    }

    const encryptedUri = String(config.encryptedUri || "");
    const decryptedUri = looksLikeEncryptedPayload(encryptedUri)
      ? KeyManager.decrypt(encryptedUri, String(organizationId))
      : encryptedUri;
    const parsedConfig = JSON.parse(decryptedUri);

    const dbConfig = {
      ...parsedConfig,
      type: config.type,
      port: parsedConfig.port ? parseInt(parsedConfig.port, 10) : undefined,
    };

    let innerSql = savedQuery.sql.trim().replace(/;?\s*$/, "");
    const isMssql = config.type === "mssql";
    const finalSql = isMssql
      ? (() => {
          if (/ORDER\s+BY/i.test(innerSql) && !/TOP\s+\d+/i.test(innerSql)) {
            innerSql = innerSql.replace(/(\bSELECT\b(\s+DISTINCT)?)/i, "$1 TOP 100 PERCENT ");
          }
          return `SELECT TOP 1000 * FROM (${innerSql}) AS _bi_source`;
        })()
      : `SELECT * FROM (${innerSql}) AS _bi_source LIMIT 1000`;

    const rows = await DbExecutor.execute(dbConfig as any, finalSql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return NextResponse.json({
      success: true,
      rows,
      columns,
      rowCount: rows.length,
    });
  } catch (error: any) {
    console.error("[BI Widget Query API] Error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to execute widget query." },
      { status: 500 }
    );
  }
}
