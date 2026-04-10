import { NextRequest, NextResponse } from "next/server";
import { DatabaseScanner } from "@/lib/db/introspection";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { configId, organizationId, type, config: rawConfig } = await req.json();
    const config = {
      ...rawConfig,
      port: rawConfig.port ? parseInt(rawConfig.port, 10) : (type === "postgres" ? 5432 : type === "mssql" ? 1433 : 3306),
    };

    if (!configId || !organizationId || !type || !config) {
      return NextResponse.json({ success: false, message: "Missing required parameters." }, { status: 400 });
    }

    let scanResult;

    // 1. Perform database scanning based on type
    if (type === "mysql") {
      scanResult = await DatabaseScanner.scanMySQL(config);
    } else if (type === "postgres") {
      scanResult = await DatabaseScanner.scanPostgres(config);
    } else if (type === "mssql") {
      scanResult = await DatabaseScanner.scanMSSQL(config);
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }

    const { tables, foreignKeys } = scanResult;

    // 2. Create/update semantic models from table metadata
    await convex.mutation(api.semanticModels.bulkUpdate, {
      organizationId,
      configId,
      tables,
    });

    // 3. Create relationships from real FK constraints
    let relCount = 0;
    if (foreignKeys.length > 0) {
      const relResult = await convex.mutation(api.semanticModels.bulkCreateRelationships, {
        organizationId,
        configId,
        foreignKeys,
      });
      relCount = relResult.count;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Scanned ${tables.length} tables and discovered ${relCount} relationships.`,
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

