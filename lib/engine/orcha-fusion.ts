import { Database } from "duckdb";
import { DbExecutor } from "../db-executor";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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
  private static conn: any = null; // Singleton connection
  private static attachedDatabases = new Map<string, string>();
  private static extensionsLoaded: Record<string, boolean> = {};

  /** Initialize DuckDB and a singleton connection once. */
  private static async getConn(): Promise<any> {
    if (!this.db) {
      try {
        console.log("[OrchaFusion] Starting engine...");
        const DuckDBMod = eval('require("duckdb")');
        const DuckDB = DuckDBMod.Database;
        const dbInstance = new DuckDB(":memory:");
        this.db = dbInstance;
        this.conn = dbInstance.connect();

        // Prevent Vercel OOM by limiting DuckDB memory
        await new Promise((resolve) => this.conn.run("PRAGMA memory_limit='1GB';", resolve));
      } catch (err: any) {
        console.error("[OrchaFusion] ENGINE LOAD FAILURE:", err.message);
        throw new Error(`OrchaFusion engine failed to start: ${err.message}`);
      }
    }
    return this.conn;
  }

  private static async ensureExtension(ext: string): Promise<void> {
    if (this.extensionsLoaded[ext]) return;
    const conn = await this.getConn();
    await this.runQuery(conn, `INSTALL ${ext}; LOAD ${ext};`);
    this.extensionsLoaded[ext] = true;
  }

  /**
   * Single-database execution.
   */
  static async execute(sql: string, schemaName: string, config: any): Promise<any[]> {
    try {
      const conn = await this.getConn();
      await this.attachDatabase(conn, schemaName, config, sql);

      // Use fully qualified names internally or search_path carefully
      // Note: search_path is connection-global, so we qualify the query instead for safety
      const qualifiedSql = sql.replace(/\bFROM\s+([a-zA-Z0-9_]+)\b/gi, `FROM ${schemaName}.$1`)
        .replace(/\bJOIN\s+([a-zA-Z0-9_]+)\b/gi, `JOIN ${schemaName}.$1`);

      return await this.allQuery(conn, sql.toLowerCase().includes(schemaName) ? sql : qualifiedSql);
    } catch (err: any) {
      console.warn("[OrchaFusion] Falling back to DbExecutor:", err.message);
      return await DbExecutor.execute(config, sql);
    }
  }

  /**
   * FEDERATED EXECUTION (Optimized)
   */
  static async executeMulti(sql: string, sources: Map<string, any>): Promise<any[]> {
    const conn = await this.getConn();

    // SURGICAL ATTACHMENT: Only attach databases referenced in the SQL (using word boundaries)
    const attachPromises: Promise<void>[] = [];
    for (const [alias, config] of sources.entries()) {
      const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
      if (aliasRegex.test(sql)) {
        attachPromises.push(this.attachDatabase(conn, alias, config, sql));
      }
    }

    if (attachPromises.length > 0) {
      console.log(`[OrchaFusion] Attaching ${attachPromises.length} referenced database(s) in parallel...`);
      await Promise.all(attachPromises);
    }

    return await this.allQuery(conn, sql);
  }

  private static async attachDatabase(conn: any, alias: string, config: any, sql: string): Promise<void> {
    const configHash = JSON.stringify(config);
    // Skip if already attached with the EXACT SAME configuration in this singleton connection
    if (this.attachedDatabases.get(alias) === configHash) return;

    // If attached w  ith a different config, detach it first to force a fresh connection
    if (this.attachedDatabases.has(alias)) {
      try {
        await this.runQuery(conn, `DETACH ${alias};`);
      } catch (e) { /* ignore detach errors */ }
    }

    if (config.type === "postgres") {
      await this.ensureExtension("postgres");
      const cs = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}${config.ssl ? "?sslmode=require" : ""}`;
      await this.runQuery(conn, `ATTACH IF NOT EXISTS '${cs}' AS ${alias} (TYPE POSTGRES);`);
    } else if (config.type === "mysql") {
      await this.ensureExtension("mysql");
      const cs = `host=${config.host} port=${config.port} user=${config.user} password=${config.password} database=${config.database}`;
      await this.runQuery(conn, `ATTACH IF NOT EXISTS '${cs}' AS ${alias} (TYPE MYSQL);`);
    } else if (config.type === "mssql") {
      await this.bridgeMssql(conn, alias, config, sql);
    }

    this.attachedDatabases.set(alias, configHash);
    console.log(`[OrchaFusion] Successfully attached [${alias}] (${config.type})`);
  }

  /**
   * MSSQL Hybrid Bridge (Corrected Regex)
   */
  private static async bridgeMssql(conn: any, alias: string, config: any, sql: string) {
    // Regex matches: alias.table or just table if it's a single DB execute
    // Format: alias.tableName
    const tableRegex = new RegExp(`(?:FROM|JOIN)\\s+["\\[]?${alias}["\\]]?\\.["\\[]?([a-zA-Z0-9_]+)["\\]]?`, "gi");
    let match;
    const found: string[] = [];
    while ((match = tableRegex.exec(sql)) !== null) {
      found.push(match[1]);
    }

    // Fallback for single-db queries where alias might be missing in SQL
    if (found.length === 0) {
      const simpleRegex = /(?:FROM|JOIN)\s+\[?([a-zA-Z0-9_]+)\]?/gi;
      while ((match = simpleRegex.exec(sql)) !== null) {
        if (!this.attachedDatabases.has(match[1])) found.push(match[1]);
      }
    }

    const tables = [...new Set(found)];
    if (tables.length === 0) return;

    await this.runQuery(conn, `CREATE SCHEMA IF NOT EXISTS ${alias};`);

    // Bridge tables in parallel
    await Promise.all(tables.map(async (table) => {
      let tempPath = "";
      try {
        console.log(`[OrchaFusion] Bridging MSSQL: ${alias}.${table}`);
        const rows = await DbExecutor.execute(config, `SELECT TOP 1000 * FROM [${table}]`);
        if (rows.length === 0) return;

        // Use a temporary file to avoid SQL injection/serialization errors with large JSON strings
        const tempDir = join(tmpdir(), "orcha-fusion");
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
        tempPath = join(tempDir, `${alias}_${table}_${Date.now()}.json`);
        
        writeFileSync(tempPath, JSON.stringify(rows));
        
        // DuckDB read_json_auto from file is much more robust than passing strings
        await this.runQuery(conn, `CREATE OR REPLACE TABLE ${alias}_${table} AS SELECT * FROM read_json_auto('${tempPath.replace(/\\/g, "/")}');`);
        await this.runQuery(conn, `CREATE OR REPLACE VIEW ${alias}.${table} AS SELECT * FROM ${alias}_${table};`);
      } catch (e) {
        console.warn(`[OrchaFusion] Failed to bridge MSSQL table ${table}:`, (e as any).message);
      } finally {
        if (tempPath && existsSync(tempPath)) {
          try { unlinkSync(tempPath); } catch (err) { /* ignore cleanup errors */ }
        }
      }
    }));
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
        else resolve(this.sanitizeRows(rows));
      });
    });
  }

  /**
   * Recursively converts BigInt values to Numbers to prevent JSON serialization errors.
   */
  private static sanitizeRows(rows: any[]): any[] {
    return rows.map(row => {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "bigint") {
          sanitized[key] = value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : String(value);
        } else if (Array.isArray(value)) {
          sanitized[key] = value.map(v => typeof v === "bigint" ? (v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : String(v)) : v);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    });
  }
}
