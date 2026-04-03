import { NextRequest, NextResponse } from "next/server";
import { DbExecutor, DbConfig } from "@/lib/db-executor";

export async function POST(req: NextRequest) {
  try {
    const config: DbConfig = await req.json();

    // Basic validation
    if (!config.host || !config.user || !config.database) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required connection parameters." 
      }, { status: 400 });
    }

    // Attempt to execute a simple query
    // PostgreSQL uses 'SELECT 1', MySQL also supports 'SELECT 1'
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
