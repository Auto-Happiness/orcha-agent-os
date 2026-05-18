import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";
import { OrchaDashboard } from "@/lib/engine/orcha-dashboard";

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
    const { dashboardId, organizationId } = await req.json();
    if (!dashboardId || !organizationId) {
      return NextResponse.json({ success: false, message: "dashboardId and organizationId are required." }, { status: 400 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (token) convex.setAuth(token);

    // 1. Fetch Dashboard & Widgets
    const dashboard: any = await convex.query(api.bi.getDashboard, { dashboardId });
    if (!dashboard || String(dashboard.organizationId) !== String(organizationId)) {
      return NextResponse.json({ success: false, message: "Dashboard not found." }, { status: 404 });
    }

    const widgets = dashboard.widgets || [];
    if (widgets.length === 0) {
      return NextResponse.json({ success: true, results: {} });
    }

    // ENFORCE LIMIT
    if (widgets.length > 7) {
      console.warn(`[Dashboard API] Dashboard ${dashboardId} exceeds 7 widget limit. Processing only the first 7.`);
    }
    const processableWidgets = widgets.slice(0, 7);

    // 2. Extract Valid Queries
    const queriesToRun: { id: string, sql: string, defaultAlias?: string, queryName?: string, type?: string, rawDb?: string }[] = [];
    
    // Fetch all configs once to avoid repeated database hits
    const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
    const configIdToAlias = new Map<string, string>();
    const dbConfigMap = new Map<string, any>();
    for (const c of allConfigs) {
      try {
        const encryptedUri = String(c.encryptedUri || "");
        const decryptedUri = looksLikeEncryptedPayload(encryptedUri)
          ? KeyManager.decrypt(encryptedUri, String(organizationId))
          : encryptedUri;
          
        const parsed = { ...JSON.parse(decryptedUri), type: c.type };
        if (parsed.port) parsed.port = parseInt(parsed.port, 10);
        
        const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        configIdToAlias.set(c._id, alias);
        dbConfigMap.set(alias, parsed);
      } catch (e) {
        console.warn(`[Dashboard API] Failed to parse config ${c.name}`);
      }
    }

    // 3. Build a per-alias table catalog from semantic models for AI-guided translation in parallel
    const aliasTableMap = new Map<string, string[]>();
    await Promise.all(
      allConfigs.map(async (c) => {
        try {
          const alias = configIdToAlias.get(c._id);
          if (!alias) return;
          const models = await convex.query(api.semanticModels.listModelsByConfig, { configId: c._id });
          const tableNames = (models || []).map((m: any) => m.tableName);
          if (tableNames.length > 0) aliasTableMap.set(alias, tableNames);
        } catch (e) { /* skip if models unavailable */ }
      })
    );

    // 4. Fetch savedQueries for all processable widgets in parallel to avoid sequential N+1 requests
    const queryPromises = processableWidgets.map(async (widget: any) => {
      if (widget.type === "text" || !widget.queryId) return null;
      try {
        const savedQuery: any = await convex.query(api.savedQueries.getById, { queryId: widget.queryId });
        if (savedQuery && savedQuery.sql) {
          const config = allConfigs.find(c => c._id === savedQuery.configId);
          let rawDb = "";
          try {
             const decrypted = looksLikeEncryptedPayload(config?.encryptedUri || "") 
               ? KeyManager.decrypt(config!.encryptedUri, organizationId) 
               : config?.encryptedUri;
             rawDb = JSON.parse(decrypted || "{}").database;
          } catch (e) {}

          return { 
            id: widget._id, 
            sql: savedQuery.sql,
            defaultAlias: configIdToAlias.get(savedQuery.configId),
            queryName: savedQuery.name,
            type: config?.type,
            rawDb: rawDb
          };
        }
      } catch (e) {
        console.warn(`[Dashboard API] Failed to fetch savedQuery for widget ${widget._id}:`, e);
      }
      return null;
    });

    const queryResults = await Promise.all(queryPromises);
    for (const res of queryResults) {
      if (res) queriesToRun.push(res);
    }

    if (queriesToRun.length === 0) {
      return NextResponse.json({ success: true, results: {} });
    }

    // 4. Fetch AI Keys for refinement
    const aiKeys = await convex.query(api.aiKeys.listByOrganization, { organizationId });

    // 5. Fire-and-forget sweep of stale L2 cache entries for this org (non-blocking)
    convex.mutation(api.bi.sweepDashboardCache, { organizationId }).catch(() => {/* ignore */});

    // 6. Execute Batch via OrchaDashboard Engine (L1+L2 cache-aware)
    const results = await OrchaDashboard.executeBatch(dashboardId, queriesToRun, dbConfigMap, aliasTableMap, aiKeys, organizationId, token ?? undefined);

    // Populate helpful skipped messages for any widgets exceeding the 7-widget ceiling
    if (widgets.length > 7) {
      const skippedWidgets = widgets.slice(7);
      for (const sw of skippedWidgets) {
        if (sw.type !== "text") {
          results[sw._id] = {
            rows: [],
            columns: [],
            error: "Dashboard ceiling exceeded (7 widget limit). Remove another widget to activate this visual.",
            queryName: sw.title
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to execute dashboard query." },
      { status: 500 }
    );
  }
}
