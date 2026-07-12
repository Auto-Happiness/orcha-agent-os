// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import postgres from "postgres";
import serverlessMysql from "serverless-mysql";
import mysql2 from "mysql2";
import * as mssql from "mssql";

export const maxDuration = 300;

const ALLOWED_SQL_PREFIXES = ["select", "show", "with"];

function isSafeSQL(sql: string): boolean {
  return ALLOWED_SQL_PREFIXES.some((p) => sql.trim().toLowerCase().startsWith(p));
}

function stripLimit(sql: string): string {
  return sql
    .trim()
    .replace(/\bLIMIT\s+\d+(\s+OFFSET\s+\d+)?(\s*;?\s*)$/im, "")
    .trim()
    .replace(/;$/, "");
}

const mssqlPools = new Map<string, any>();

async function getMssqlPool(config: any): Promise<any> {
  const key = `${config.host}:${config.port || 1433}/${config.database}/${config.user}/${config.instanceName || ""}`;
  if (!mssqlPools.has(key)) {
    const pool = new mssql.ConnectionPool({
      server: config.host,
      port: config.port ? parseInt(config.port, 10) : 1433,
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt: config.encrypt ?? config.ssl ?? true,
        trustServerCertificate: config.trustServerCertificate ?? true,
        instanceName: config.instanceName,
      },
      connectionTimeout: 15_000,
      pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    });
    await pool.connect();
    mssqlPools.set(key, pool);
  }
  return mssqlPools.get(key)!;
}

function adjustLimitForExport(sql: string, dbType: string): string {
  if (dbType === "mssql") {
    const topRegex = /\bTOP\s+(\d+)\b/i;
    const match = sql.match(topRegex);
    if (match) {
      const originalLimit = parseInt(match[1], 10);
      const newLimit = originalLimit === 50 ? 500 : Math.min(originalLimit, 500);
      return sql.replace(/\b(TOP\s+)\d+\b/i, `$1${newLimit}`);
    } else {
      const cleanSql = sql.trim().replace(/;$/, "");
      const selectDistinctRegex = /^(\s*SELECT\s+DISTINCT\s+)/i;
      const selectRegex = /^(\s*SELECT\s+)/i;
      if (selectDistinctRegex.test(cleanSql)) {
        return cleanSql.replace(selectDistinctRegex, "$1TOP 500 ");
      } else if (selectRegex.test(cleanSql)) {
        return cleanSql.replace(selectRegex, "$1TOP 500 ");
      }
      return cleanSql;
    }
  } else if (dbType === "oracle") {
    const fetchRegex = /\bFETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY\b/i;
    const match = sql.match(fetchRegex);
    if (match) {
      const originalLimit = parseInt(match[1], 10);
      const newLimit = originalLimit === 50 ? 500 : Math.min(originalLimit, 500);
      return sql.replace(/\b(FETCH\s+FIRST\s+)\d+(\s+ROWS\s+ONLY)\b/i, `$1${newLimit}$2`);
    } else {
      const cleanSql = sql.trim().replace(/;$/, "");
      return `${cleanSql} FETCH FIRST 500 ROWS ONLY`;
    }
  }

  const limitRegex = /\bLIMIT\s+(\d+)\b/i;
  const match = sql.match(limitRegex);
  if (match) {
    const originalLimit = parseInt(match[1], 10);
    const newLimit = originalLimit === 50 ? 500 : Math.min(originalLimit, 500);
    return sql.replace(/\b(LIMIT\s+)\d+\b/i, `$1${newLimit}`);
  } else {
    const cleanSql = sql.trim().replace(/;$/, "");
    return `${cleanSql} LIMIT 500`;
  }
}

function escapeCell(v: any): string {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function POST(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    const clerkAuth = await auth();
    const { userId, orgId: clerkOrgId } = clerkAuth;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sql, configId: rawConfigId, organizationId: rawOrgId } = await req.json();

    if (!sql || !isSafeSQL(sql)) {
      return NextResponse.json({ error: "Invalid or unsafe SQL." }, { status: 400 });
    }

    const orgIdStr = rawOrgId || clerkOrgId || "";
    if (!orgIdStr) return NextResponse.json({ error: "Organization context missing." }, { status: 400 });

    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    let organizationId: Id<"organizations">;
    if (orgIdStr.startsWith("org_")) {
      const orgRecord = await convex.query(api.organizations.getSafeBySlug, { slug: orgIdStr });
      if (!orgRecord) {
        return NextResponse.json({ error: "Convex organization not found for this Clerk organization." }, { status: 404 });
      }
      organizationId = orgRecord._id;
    } else {
      organizationId = orgIdStr as Id<"organizations">;
    }

    const configId = rawConfigId as Id<"databaseConfigs"> | undefined;

    const isAsync = process.env.ASYNC === "on";
    if (isAsync) {
      console.log(`[Export] ASYNC mode active. Enqueueing CSV export job...`);
      const { CSVExportWorker } = await import("@/lib/bridge/worker");
      const exportWorker = new CSVExportWorker();
      const filename = `export_${Date.now()}.csv`;
      
      const job = await exportWorker.addJob({
        sql,
        organizationId,
        configId,
        filename,
        clerkToken: token || undefined,
      });

      await exportWorker.close();

      return NextResponse.json({
        success: true,
        mode: "async",
        jobId: job.id,
      });
    }

    let config: any;
    if (configId) {
      const all = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
      config = all.find((c: any) => c._id === configId);
    }
    if (!config) config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
    if (!config) return NextResponse.json({ error: "Database config not found." }, { status: 400 });

    const raw = JSON.parse(config.encryptedUri);
    const dbConfig = { ...raw, type: config.type, port: raw.port ? parseInt(raw.port, 10) : undefined };

    const exportSql = adjustLimitForExport(sql, dbConfig.type);
    console.log(`[Export] ${dbConfig.type} | SQL: ${exportSql.replace(/\s+/g, " ").substring(0, 120)}`);

    const filename = `export_${Date.now()}.csv`;
    const encoder = new TextEncoder();

    // ── Postgres: cursor-based streaming via postgres (porsager) ─────────────
    if (dbConfig.type === "postgres") {
      const sql = postgres({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        ssl: dbConfig.ssl ? "require" : false,
        max: 1,
      });

      const stream = new ReadableStream({
        async start(controller) {
          let headerWritten = false;
          let cols: string[] = [];
          let rowCount = 0;
          try {
            // postgres cursor streams rows in configurable batch sizes
            for await (const rows of sql.unsafe(exportSql).cursor(100)) {
              for (const row of rows) {
                if (!headerWritten) {
                  cols = Object.keys(row);
                  controller.enqueue(encoder.encode(cols.join(",") + "\n"));
                  headerWritten = true;
                }
                controller.enqueue(encoder.encode(cols.map(c => escapeCell(row[c])).join(",") + "\n"));
                rowCount++;
              }
            }
            console.log(`[Export] Streamed ${rowCount} rows`);
            controller.close();
          } catch (err: any) {
            console.error("[Export] Stream error:", err.message);
            controller.error(err);
          } finally {
            await sql.end();
          }
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── MySQL / MariaDB: streaming via mysql2 ─────────────────────────────────
    if (dbConfig.type === "mysql" || dbConfig.type === "mariadb") {
      const stream = new ReadableStream({
        async start(controller) {
          const conn = mysql2.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
          });

          const mysqlSql = exportSql.replace(/\$\d+/g, "?");
          const rowStream = conn.query(mysqlSql).stream();

          let headerWritten = false;
          let cols: string[] = [];
          let rowCount = 0;

          rowStream.on("data", (row: any) => {
            if (!headerWritten) {
              cols = Object.keys(row);
              controller.enqueue(encoder.encode(cols.join(",") + "\n"));
              headerWritten = true;
            }
            controller.enqueue(encoder.encode(cols.map(c => escapeCell(row[c])).join(",") + "\n"));
            rowCount++;
          });

          rowStream.on("end", () => {
            console.log(`[Export] Streamed ${rowCount} rows`);
            conn.end();
            controller.close();
          });

          rowStream.on("error", (err: Error) => {
            console.error("[Export] Stream error:", err.message);
            conn.end();
            controller.error(err);
          });
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── MSSQL: streaming via mssql package ─────────────────────────────────────
    if (dbConfig.type === "mssql") {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const pool = await getMssqlPool(dbConfig);
            const request = pool.request();
            request.stream = true;

            let headerWritten = false;
            let cols: string[] = [];
            let rowCount = 0;

            request.query(exportSql);

            request.on("row", (row: any) => {
              if (!headerWritten) {
                cols = Object.keys(row);
                controller.enqueue(encoder.encode(cols.join(",") + "\n"));
                headerWritten = true;
              }
              controller.enqueue(encoder.encode(cols.map(c => escapeCell(row[c])).join(",") + "\n"));
              rowCount++;
            });

            request.on("done", () => {
              console.log(`[Export] Streamed ${rowCount} rows`);
              controller.close();
            });

            request.on("error", (err: Error) => {
              console.error("[Export] Stream error:", err.message);
              controller.error(err);
            });
          } catch (err: any) {
            console.error("[Export] Stream connection error:", err.message);
            controller.error(err);
          }
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── Oracle: streaming via queryStream ─────────────────────────────────────
    if (dbConfig.type === "oracle") {
      const stream = new ReadableStream({
        async start(controller) {
          let connection: any;
          try {
            const oracledb = require("oracledb");
            const connAttrs: any = {
              user: dbConfig.user,
              password: dbConfig.password,
            };
            if (dbConfig.connectString) {
              connAttrs.connectString = dbConfig.connectString;
            } else {
              connAttrs.connectString = `${dbConfig.host}:${dbConfig.port || 1521}/${dbConfig.database}`;
            }

            connection = await oracledb.getConnection(connAttrs);
            const rowStream = connection.queryStream(exportSql, [], {
              outFormat: oracledb.OUT_FORMAT_OBJECT,
            });

            let headerWritten = false;
            let cols: string[] = [];
            let rowCount = 0;

            rowStream.on("data", (row: any) => {
              if (!headerWritten) {
                cols = Object.keys(row);
                controller.enqueue(encoder.encode(cols.join(",") + "\n"));
                headerWritten = true;
              }
              controller.enqueue(encoder.encode(cols.map(c => escapeCell(row[c])).join(",") + "\n"));
              rowCount++;
            });

            rowStream.on("end", async () => {
              console.log(`[Export] Streamed ${rowCount} rows`);
              if (connection) {
                try { await connection.close(); } catch (e) {}
              }
              controller.close();
            });

            rowStream.on("error", async (err: Error) => {
              console.error("[Export] Stream error:", err.message);
              if (connection) {
                try { await connection.close(); } catch (e) {}
              }
              controller.error(err);
            });
          } catch (err: any) {
            console.error("[Export] Stream connection error:", err.message);
            if (connection) {
              try { await (connection as any).close(); } catch (e) {}
            }
            controller.error(err);
          }
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: `Streaming export not supported for ${dbConfig.type}.` }, { status: 400 });

  } catch (err: any) {
    console.error("[Export] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "Job ID missing." }, { status: 400 });
    }

    const { CSVExportWorker } = await import("@/lib/bridge/worker");
    const exportWorker = new CSVExportWorker();

    const job = await exportWorker.getJob(jobId);
    if (!job) {
      await exportWorker.close();
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    const isCompleted = await job.isCompleted();
    const isFailed = await job.isFailed();

    if (isCompleted) {
      const result = job.returnvalue;
      await exportWorker.close();
      return NextResponse.json({ status: "completed", downloadUrl: result?.downloadUrl });
    } else if (isFailed) {
      const failedReason = job.failedReason || "Unknown job failure.";
      await exportWorker.close();
      return NextResponse.json({ status: "failed", error: failedReason });
    } else {
      await exportWorker.close();
      return NextResponse.json({ status: "active" });
    }
  } catch (err: any) {
    console.error("[Export GET] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
