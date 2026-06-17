import { NextRequest, NextResponse } from "next/server";
import { DatabaseScanner } from "@/lib/db/introspection";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { KeyManager } from "@/lib/key-manager";
import { withMetrics } from "@/lib/metrics";
import { compileScanToMdl } from "@/lib/semantic-compiler";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

async function postHandler(req: NextRequest) {
  const convex = getConvexClient();
  try {
    const body = await req.json();
    const { configId, organizationId, type, config: rawConfig } = body;
    const config = {
      ...rawConfig,
      port: rawConfig.port ? parseInt(rawConfig.port, 10) : (type === "postgres" ? 5432 : type === "mssql" ? 1433 : type === "oracle" ? 1521 : 3306),
    };

    if (!configId || !organizationId || !type || !config) {
      return NextResponse.json({ success: false, message: "Missing required parameters." }, { status: 400 });
    }

    // Attach Clerk token so Convex auth-gated queries work from server
    const clerkAuth = await auth();
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    let scanResult;

    // 1. Perform database scanning based on type
    if (type === "mysql") {
      scanResult = await DatabaseScanner.scanMySQL(config);
    } else if (type === "mariadb") {
      scanResult = await DatabaseScanner.scanMariaDB(config);
    } else if (type === "postgres") {
      scanResult = await DatabaseScanner.scanPostgres(config);
    } else if (type === "mssql") {
      scanResult = await DatabaseScanner.scanMSSQL(config);
    } else if (type === "sqlite") {
      // SQLite uses filePath from rawConfig, not the parsed network config
      scanResult = await DatabaseScanner.scanSQLite(rawConfig);
    } else if (type === "oracle") {
      scanResult = await DatabaseScanner.scanOracle(config);
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }

    const { tables, foreignKeys } = scanResult;

    // 1. Create/update V1 semantic models from table metadata (for configure UI)
    await convex.mutation(api.semanticModels.bulkUpdate, {
      organizationId,
      configId,
      tables,
    });

    // 2. Create V1 relationships from real FK constraints (for configure UI)
    let relCount = 0;
    if (foreignKeys.length > 0) {
      const relResult = await convex.mutation(api.semanticModels.bulkCreateRelationships, {
        organizationId,
        configId,
        foreignKeys,
      });
      relCount = relResult.count;
    }

    // 3. Compile and save V2 MDL manifest (for RAG / WASM engine)
    const mdl = compileScanToMdl(tables, foreignKeys);
    await convex.mutation(api.mdlManifests.save, {
      organizationId,
      configId,
      catalog: mdl.catalog,
      schema: mdl.schema,
      models: mdl.models,
      relationships: mdl.relationships,
      views: mdl.views,
    });

    // 4. Trigger background vector indexing for the MDL manifest
    try {
      const allKeys = await convex.query(api.aiKeys.listByOrganization, { organizationId });
      const preferredKey = allKeys.find((k: any) => k.provider === "openai" || k.provider === "gemini");
      
      if (preferredKey) {
        let plaintextKey = preferredKey.keyValue;
        if (preferredKey.storageStrategy === "convex" || !preferredKey.storageStrategy) {
          const parts = preferredKey.keyValue.split(":");
          if (parts.length === 3) {
            try {
              plaintextKey = KeyManager.decrypt(preferredKey.keyValue, organizationId);
            } catch (err: any) {
              console.error(`[Scan] Decryption failed, using key as-is:`, err.message);
            }
          }
        }

        console.log(`[Scan] Triggering embedding indexing with provider: ${preferredKey.provider}`);
        
        convex.action(api.embeddings.indexMdlManifest, {
          organizationId,
          configId,
          provider: preferredKey.provider as "openai" | "gemini" | "local",
          apiKey: plaintextKey,
        }).then(result => {
          console.log(`[Scan] Indexing complete:`, result);
        }).catch(err => {
          console.error(`[Scan] Indexing failed:`, err);
        });
      } else {
        console.warn(`[Scan] No OpenAI/Gemini key found for org ${organizationId}. Skipping indexing.`);
      }
    } catch(e: any) {
      console.error(`[Scan] Failed to start indexing:`, e.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Scanned ${tables.length} tables, compiled MDL manifest, and created ${relCount} relationships.`,
      count: tables.length,
      relationships: relCount,
    });
  } catch (error: any) {
    console.error("Scan error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "An error occurred during database scanning."
    }, { status: 500 });
  }
}

export const POST = withMetrics("/api/db/scan", postHandler);

