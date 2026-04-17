import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import postgres from "postgres";
import serverlessMysql from "serverless-mysql";

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

    const organizationId = orgIdStr as Id<"organizations">;
    const configId = rawConfigId as Id<"databaseConfigs"> | undefined;

    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    let config: any;
    if (configId) {
      const all = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
      config = all.find((c: any) => c._id === configId);
    }
    if (!config) config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
    if (!config) return NextResponse.json({ error: "Database config not found." }, { status: 400 });

    const raw = JSON.parse(config.encryptedUri);
    const dbConfig = { ...raw, type: config.type, port: raw.port ? parseInt(raw.port, 10) : undefined };

    const exportSql = stripLimit(sql);
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

    // ── MySQL: streaming via mysql2 ───────────────────────────────────────────
    if (dbConfig.type === "mysql") {
      const stream = new ReadableStream({
        async start(controller) {
          const db = serverlessMysql({
            config: {
              host: dbConfig.host, port: dbConfig.port, user: dbConfig.user,
              password: dbConfig.password, database: dbConfig.database,
              ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
            },
          });

          // mysql2 streaming via connection.query().stream()
          const conn = await (db as any).getConnection();
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

          rowStream.on("end", async () => {
            console.log(`[Export] Streamed ${rowCount} rows`);
            await db.quit();
            controller.close();
          });

          rowStream.on("error", async (err: Error) => {
            console.error("[Export] Stream error:", err.message);
            await db.quit();
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

    return NextResponse.json({ error: `Streaming export not supported for ${dbConfig.type}.` }, { status: 400 });

  } catch (err: any) {
    console.error("[Export] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
