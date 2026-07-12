import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import fs from "fs";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import postgres from "postgres";
import mysql2 from "mysql2";
import * as mssql from "mssql";

function escapeCell(v: any): string {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
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

export class CSVExportWorker {
  private redis: IORedis;
  private workerRedis: IORedis;
  private queue: Queue;
  private worker: Worker;

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.workerRedis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    
    this.queue = new Queue("data-exports", { connection: this.redis });

    this.worker = new Worker(
      "data-exports",
      async (job) => {
        const { sql, organizationId, configId, filename, clerkToken } = job.data;
        console.log(`[CSVExportWorker] Starting export job ${job.id} for Org ${organizationId}`);

        try {
          const result = await this.streamToCSV(sql, organizationId, configId, filename, clerkToken);
          await job.updateProgress(100);
          return result;
        } catch (error: any) {
          console.error(`[CSVExportWorker] Export job ${job.id} failed:`, error);
          throw error;
        }
      },
      { connection: this.workerRedis }
    );
  }

  async streamToCSV(
    sqlQuery: string,
    organizationId: string,
    configId?: string,
    filename = `export_${Date.now()}.csv`,
    clerkToken?: string
  ): Promise<any> {
    const exportDir = path.join(process.cwd(), "public", "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const filePath = path.join(exportDir, filename);
    const writableStream = fs.createWriteStream(filePath);

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (clerkToken) {
      convex.setAuth(clerkToken);
    }
    
    let config: any;
    if (configId) {
      const all = await convex.query(api.databaseConfigs.listByOrganization, { 
        organizationId: organizationId as Id<"organizations"> 
      });
      config = all.find((c: any) => c._id === configId);
    }
    if (!config) {
      config = await convex.query(api.databaseConfigs.getByOrganization, { 
        organizationId: organizationId as Id<"organizations"> 
      });
    }
    if (!config) {
      throw new Error("Database config not found.");
    }

    const raw = JSON.parse(config.encryptedUri);
    const dbConfig = { ...raw, type: config.type, port: raw.port ? parseInt(raw.port, 10) : undefined };

    const exportSql = adjustLimitForExport(sqlQuery, dbConfig.type);

    return new Promise((resolve, reject) => {
      writableStream.on("error", (err) => {
        reject(err);
      });

      if (dbConfig.type === "postgres") {
        const sqlClient = postgres({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          password: dbConfig.password,
          database: dbConfig.database,
          ssl: dbConfig.ssl ? "require" : false,
          max: 1,
        });

        (async () => {
          let headerWritten = false;
          let cols: string[] = [];
          try {
            for await (const rows of sqlClient.unsafe(exportSql).cursor(100)) {
              for (const row of rows) {
                if (!headerWritten) {
                  cols = Object.keys(row);
                  writableStream.write(cols.join(",") + "\n");
                  headerWritten = true;
                }
                writableStream.write(cols.map(c => escapeCell(row[c])).join(",") + "\n");
              }
            }
            writableStream.end();
            resolve({ 
              status: "completed", 
              filename, 
              downloadUrl: `/exports/${filename}` 
            });
          } catch (err: any) {
            reject(err);
          } finally {
            await sqlClient.end();
          }
        })();
      } else if (dbConfig.type === "mysql" || dbConfig.type === "mariadb") {
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

        rowStream.on("data", (row: any) => {
          if (!headerWritten) {
            cols = Object.keys(row);
            writableStream.write(cols.join(",") + "\n");
            headerWritten = true;
          }
          writableStream.write(cols.map(c => escapeCell(row[c])).join(",") + "\n");
        });

        rowStream.on("end", () => {
          conn.end();
          writableStream.end();
          resolve({ 
            status: "completed", 
            filename, 
            downloadUrl: `/exports/${filename}` 
          });
        });

        rowStream.on("error", (err: Error) => {
          conn.end();
          reject(err);
        });
      } else if (dbConfig.type === "mssql") {
        (async () => {
          try {
            const pool = await getMssqlPool(dbConfig);
            const request = pool.request();
            request.stream = true;

            let headerWritten = false;
            let cols: string[] = [];

            request.query(exportSql);

            request.on("row", (row: any) => {
              if (!headerWritten) {
                cols = Object.keys(row);
                writableStream.write(cols.join(",") + "\n");
                headerWritten = true;
              }
              writableStream.write(cols.map(c => escapeCell(row[c])).join(",") + "\n");
            });

            request.on("done", () => {
              writableStream.end();
              resolve({
                status: "completed",
                filename,
                downloadUrl: `/exports/${filename}`
              });
            });

            request.on("error", (err: Error) => {
              reject(err);
            });
          } catch (err: any) {
            reject(err);
          }
        })();
      } else if (dbConfig.type === "oracle") {
        (async () => {
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

            rowStream.on("data", (row: any) => {
              if (!headerWritten) {
                cols = Object.keys(row);
                writableStream.write(cols.join(",") + "\n");
                headerWritten = true;
              }
              writableStream.write(cols.map(c => escapeCell(row[c])).join(",") + "\n");
            });

            rowStream.on("end", async () => {
              writableStream.end();
              if (connection) {
                try { await connection.close(); } catch (e) {}
              }
              resolve({
                status: "completed",
                filename,
                downloadUrl: `/exports/${filename}`
              });
            });

            rowStream.on("error", async (err: Error) => {
              if (connection) {
                try { await connection.close(); } catch (e) {}
              }
              reject(err);
            });
          } catch (err: any) {
            if (connection) {
              try { await (connection as any).close(); } catch (e) {}
            }
            reject(err);
          }
        })();
      } else {
        reject(new Error(`Streaming export not supported for ${dbConfig.type}.`));
      }
    });
  }

  async addJob(data: any) {
    return await this.queue.add("csv-export", data);
  }

  async getJob(jobId: string) {
    return await this.queue.getJob(jobId);
  }

  async close() {
    await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
    await this.workerRedis.quit();
  }
}
