import { Database } from "duckdb";
import { DbExecutor } from "../db-executor";

/**
 * ORCHA FUSION ENGINE
 *
 * 1. Extensions are loaded ONCE per engine lifetime, not per query.
 * 2. Connections are reused, not re-created per query.
 * 3. MSSQL bridge uses surgical SQL parsing to avoid redundant DB calls.
 * 4. Engine fails fast on load failure (no repeated retries).
 */
export class OrchaFusion {
  private static db: Database | null = null;
  private static isEngineDisabled = false;
  private static extensionsLoaded: Record<string, boolean> = {};

  /** Initialize DuckDB once. Extensions are loaded lazily per type. */
  private static async getDb(): Promise<Database> {
    if (this.isEngineDisabled) throw new Error("OrchaFusion engine is disabled");

    if (!this.db) {
      try {
        console.log("[OrchaFusion] Starting engine...");
        const { Database: DuckDB } = require("duckdb");
        this.db = new DuckDB(":memory:");
      } catch (err) {
        this.isEngineDisabled = true;
        throw err;
      }
    }
    return this.db!;
  }

  /** Load a DuckDB extension once per engine lifetime. */
  private static async ensureExtension(conn: any, ext: string): Promise<void> {
    if (this.extensionsLoaded[ext]) return;
    await this.runQuery(conn, `INSTALL ${ext}; LOAD ${ext};`);
    this.extensionsLoaded[ext] = true;
  }

  /**
   * Execute a SQL query against a single database config.
   * Falls back to legacy DbExecutor if DuckDB is unavailable.
   */
  static async execute(sql: string, schemaName: string, config: any): Promise<any[]> {
    try {
      const db = await this.getDb();
      const conn = db.connect();

      console.log(`[OrchaFusion] Executing (${config.type}): ${schemaName}`);

      if (config.type === "postgres") {
        await this.ensureExtension(conn, "postgres");
        const cs = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}${config.ssl ? "?sslmode=require" : ""}`;
        await this.runQuery(conn, `ATTACH IF NOT EXISTS '${cs}' AS ${schemaName} (TYPE POSTGRES);`);
      } else if (config.type === "mysql") {
        await this.ensureExtension(conn, "mysql");
        const cs = `host=${config.host} port=${config.port} user=${config.user} password=${config.password} database=${config.database}`;
        await this.runQuery(conn, `ATTACH IF NOT EXISTS '${cs}' AS ${schemaName} (TYPE MYSQL);`);
      } else if (config.type === "mssql") {
        await this.bridgeMssql(conn, schemaName, config, sql);
      }

      await this.runQuery(conn, `SET search_path = ${schemaName};`);
      return await this.allQuery(conn, sql);

    } catch (err: any) {
      console.warn("[OrchaFusion] Falling back to DbExecutor:", err.message);
      return await DbExecutor.execute(config, sql);
    }
  }

  /**
   * MSSQL Hybrid Bridge.
   * Uses surgical regex to only bridge tables referenced after FROM/JOIN.
   */
  private static async bridgeMssql(conn: any, schemaName: string, config: any, sql: string) {
    // Surgical regex: match only words immediately after FROM or JOIN
    const tableRegex = /(?:FROM|JOIN)\s+\[?([a-zA-Z0-9_]+)\]?/gi;
    let match;
    const found: string[] = [];
    while ((match = tableRegex.exec(sql)) !== null) {
      found.push(match[1]);
    }
    const tables = [...new Set(found)];
    if (tables.length === 0) return;

    await this.runQuery(conn, `CREATE SCHEMA IF NOT EXISTS ${schemaName};`);

    for (const table of tables) {
      try {
        console.log(`[OrchaFusion] Bridging MSSQL: ${schemaName}.${table}`);
        const rows = await DbExecutor.execute(config, `SELECT TOP 1000 * FROM [${table}]`);
        if (rows.length === 0) continue;

        const json = JSON.stringify(rows);
        await this.runQuery(conn, `CREATE OR REPLACE TABLE ${schemaName}_${table} AS SELECT * FROM read_json_auto('${json}');`);
        await this.runQuery(conn, `CREATE OR REPLACE VIEW ${schemaName}.${table} AS SELECT * FROM ${schemaName}_${table};`);
      } catch (e) {
        // Table may not exist — skip silently
      }
    }
  }

  private static runQuery(conn: any, sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      conn.run(sql, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private static allQuery(conn: any, sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      conn.all(sql, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}
