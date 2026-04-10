import { NextRequest, NextResponse } from "next/server";
import { DbExecutor, DbConfig } from "@/lib/db-executor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: DbConfig = {
      ...body,
      port: body.port ? parseInt(body.port, 10) : (body.type === "postgres" ? 5432 : body.type === "mssql" ? 1433 : 3306),
    };

    // Basic validation
    if (!config.host || !config.user || !config.database) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required connection parameters. Host, User, and Database are mandatory." 
      }, { status: 400 });
    }

    // Attempt to execute a simple query
    console.log(`[API] Testing connection to ${config.type} at ${config.host}...`);
    const startTime = Date.now();
    await DbExecutor.execute(config, "SELECT 1");
    const duration = Date.now() - startTime;

    return NextResponse.json({ 
      success: true, 
      message: `Connection successful! (Latency: ${duration}ms)` 
    });
  } catch (error: any) {
    console.error("Test connection error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Failed to connect to the database." 
    }, { status: 500 });
  }
}
