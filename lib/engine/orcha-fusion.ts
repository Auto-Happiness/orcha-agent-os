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

  // Promise pool: if two parallel queries try to attach the same alias simultaneously,
  // the second one waits on the first's promise rather than running a duplicate attachment.
  private static activeAttachments = new Map<string, Promise<void>>();

  // Tracks "alias.tableName" keys of MSSQL tables that are already bridged into DuckDB.
  // Prevents redundant SELECT TOP 1000 fetches across widget queries in the same engine lifetime.
  private static bridgedTables = new Set<string>();

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
    if (this.attachedDatabases.get(alias) === configHash) {
      // For MSSQL databases, we still need to check if there are new tables referenced
      // in this query that haven't been bridged yet, and bridge them incrementally.
      if (config.type === "mssql") {
        await this.bridgeMssql(conn, alias, config, sql);
      }
      return;
    }

    // PROMISE POOLING: If another parallel query is currently in the middle of attaching
    // this same alias, wait for that existing promise instead of running a duplicate attachment.
    const existingAttachment = this.activeAttachments.get(alias);
    if (existingAttachment) {
      console.log(`[OrchaFusion] Waiting for in-progress attachment of [${alias}]...`);
      await existingAttachment;
      // We must still ensure that any tables referenced in THIS query are bridged incrementally
      if (config.type === "mssql") {
        await this.bridgeMssql(conn, alias, config, sql);
      }
      return;
    }

    // Register our attachment promise so parallel callers can pool on it
    const attachmentWork = (async () => {
      // If attached with a different config, detach first to force a fresh connection
      if (this.attachedDatabases.has(alias)) {
        try {
          await this.runQuery(conn, `DETACH ${alias};`);
          // Invalidate all bridged table entries for this alias so they are re-fetched
          for (const key of this.bridgedTables) {
            if (key.startsWith(`${alias}.`)) this.bridgedTables.delete(key);
          }
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
    })();

    this.activeAttachments.set(alias, attachmentWork);
    try {
      await attachmentWork;
    } finally {
      // Always clean up the promise pool entry once the work is done (success or failure)
      this.activeAttachments.delete(alias);
    }
  }

  /**
   * MSSQL Hybrid Bridge — incremental and deduplicated.
   *
   * Uses `bridgedTables` to skip tables that are already loaded into DuckDB memory,
   * preventing redundant SELECT TOP 1000 fetches across parallel widget queries.
   */
  private static async bridgeMssql(conn: any, alias: string, config: any, sql: string) {
    // Regex matches: alias.table or just table if it's a single DB execute
    const tableRegex = new RegExp(`(?:FROM|JOIN)\\s+["\\[]?${alias}["\\]]?\\.["\[]?([a-zA-Z0-9_]+)["\\]]?`, "gi");
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

    const allTables = [...new Set(found)];
    if (allTables.length === 0) return;

    // DEDUPLICATION: Only bridge tables that are NOT already loaded in DuckDB memory
    const tablesToBridge = allTables.filter(table => !this.bridgedTables.has(`${alias}.${table}`));

    if (tablesToBridge.length === 0) {
      console.log(`[OrchaFusion] All MSSQL tables for [${alias}] already bridged. Skipping fetch.`);
      return;
    }

    if (tablesToBridge.length < allTables.length) {
      console.log(`[OrchaFusion] Incremental bridge: ${tablesToBridge.length}/${allTables.length} new table(s) for [${alias}].`);
    }

    await this.runQuery(conn, `CREATE SCHEMA IF NOT EXISTS ${alias};`);

    // Bridge only the new, un-bridged tables in parallel
    await Promise.all(tablesToBridge.map(async (table) => {
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

        // Mark this table as bridged so subsequent queries skip the fetch entirely
        this.bridgedTables.add(`${alias}.${table}`);
        console.log(`[OrchaFusion] Successfully bridged MSSQL table [${alias}.${table}].`);
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
