import { NextRequest, NextResponse } from "next/server";
import { DbExecutor, DbConfig } from "@/lib/db-executor";
import fs from "fs";

const TIMEOUT_MS = 15_000;

/** Flatten AggregateError (thrown by mysql2 when all TCP attempts fail) into a readable message. */
function extractErrorMessage(error: any): string {
  if (error instanceof AggregateError && error.errors?.length) {
    const causes = error.errors.map((e: any) => e.code ? `${e.code}: ${e.message}` : e.message).join("; ");
    return `All connection attempts failed – ${causes}`;
  }
  if (error.code) return `${error.code}: ${error.message}`;
  return error.message || "Unknown error";
}

/** Suggest the correct provider when a port mismatch is detected. */
function portProviderHint(type: string, port: number): string | null {
  if (type === "mysql" && port === 1433) return "Port 1433 is the MSSQL default port. Did you mean to select the MSSQL provider?";
  if (type === "mysql" && port === 5432) return "Port 5432 is the PostgreSQL default port. Did you mean to select the PostgreSQL provider?";
  if (type === "postgres" && port === 3306) return "Port 3306 is the MySQL default port. Did you mean to select the MySQL provider?";
  if (type === "postgres" && port === 1433) return "Port 1433 is the MSSQL default port. Did you mean to select the MSSQL provider?";
  if (type === "mssql" && port === 3306) return "Port 3306 is the MySQL default port. Did you mean to select the MySQL provider?";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[test-connection] Request:", JSON.stringify({ ...body, password: body.password ? "***" : undefined }));

    const type = body.type as string;

    // ── SQLite: file-based, no network params ──────────────────────────────
    if (type === "sqlite") {
      const { filePath } = body;
      if (!filePath) {
        return NextResponse.json({ success: false, message: "SQLite requires a file path." }, { status: 400 });
      }
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ success: false, message: `File not found: ${filePath}` }, { status: 400 });
      }

      console.log(`[test-connection] Testing SQLite at: ${filePath}`);
      const startTime = Date.now();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`SQLite test timed out after ${TIMEOUT_MS / 1000}s.`)), TIMEOUT_MS)
      );

      await Promise.race([
        DbExecutor.execute({ type: "sqlite", filePath }, "SELECT 1"),
        timeoutPromise,
      ]);

      const duration = Date.now() - startTime;
      console.log(`[test-connection] SQLite SUCCESS – ${duration}ms`);
      return NextResponse.json({ success: true, message: `SQLite connection successful! (${duration}ms)` });
    }

    // ── Network databases (MySQL, PostgreSQL, MSSQL) ───────────────────────
    const config: DbConfig = {
      ...body,
      port: body.port ? parseInt(body.port, 10) : (type === "postgres" ? 5432 : type === "mssql" ? 1433 : 3306),
    };

    // Basic validation
    if (!config.host || !config.user || !config.database) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required connection parameters. Host, User, and Database are mandatory." 
      }, { status: 400 });
    }

    // Warn about obvious port/provider mismatches before even attempting
    const hint = portProviderHint(config.type, config.port!);
    if (hint) {
      console.warn(`[test-connection] Port mismatch detected: ${hint}`);
      return NextResponse.json({ success: false, message: hint }, { status: 400 });
    }

    console.log(`[test-connection] Attempting ${config.type} → ${config.host}:${config.port}/${config.database} ssl=${!!config.ssl}`);
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Connection timed out after ${TIMEOUT_MS / 1000}s – host unreachable or port blocked by firewall.`)),
        TIMEOUT_MS
      )
    );

    await Promise.race([
      DbExecutor.execute(config, "SELECT 1"),
      timeoutPromise,
    ]);

    const duration = Date.now() - startTime;
    console.log(`[test-connection] SUCCESS – ${duration}ms`);

    return NextResponse.json({ 
      success: true, 
      message: `Connection successful! (Latency: ${duration}ms)` 
    });

  } catch (error: any) {
    const message = extractErrorMessage(error);
    console.error("[test-connection] FAILED:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
