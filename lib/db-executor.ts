import postgres from "postgres";
import serverlessMysql from "serverless-mysql";
import * as mssql from "mssql";
import Database from "better-sqlite3";

export type DbConfig = {
  type: "mysql" | "postgres" | "mssql" | "sqlite";
  // Network-based databases
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  ssl?: boolean;
  // MSSQL specific
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  instanceName?: string;
  // SQLite — local file path only
  filePath?: string;
};

// MSSQL connection pool cache
const mssqlPools = new Map<string, any>();

async function getMssqlPool(config: DbConfig): Promise<any> {
  const key = `${config.host}:${config.port}/${config.database}/${config.user}/${config.instanceName || ""}`;
  if (!mssqlPools.has(key)) {
    console.log(`[DbExecutor] Connecting to MSSQL: ${config.host}:${config.port} (instance: ${config.instanceName || "default"})...`);
    const pool = new mssql.ConnectionPool({
      server: config.host!,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt: config.encrypt ?? config.ssl ?? true,
        trustServerCertificate: config.trustServerCertificate ?? true,
        instanceName: config.instanceName,
      },
      connectionTimeout: 12_000,
      pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    });
    await pool.connect();
    mssqlPools.set(key, pool);
  }
  return mssqlPools.get(key)!;
}

export class DbExecutor {
  static async execute(config: DbConfig, query: string, params: any[] = []): Promise<any[]> {
    console.log(`[DbExecutor] Executing ${config.type} query: ${query.substring(0, 50)}...`);
    try {
      if (config.type === "mysql") return await this.executeMysql(config, query, params);
      if (config.type === "postgres") return await this.executePostgres(config, query, params);
      if (config.type === "mssql") return await this.executeMssql(config, query, params);
      if (config.type === "sqlite") return await this.executeSqlite(config, query, params);
      throw new Error(`Unsupported database type: ${(config as any).type}`);
    } catch (err: any) {
      console.error(`[DbExecutor] ${config.type} execution error:`, err.message);
      throw err;
    }
  }

  private static async executeMysql(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Connecting to MySQL at ${config.host}:${config.port}/${config.database} (ssl=${!!config.ssl})...`);
    const db = serverlessMysql({
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        // Prevents hanging on unreachable hosts — passed directly to mysql2
        connectTimeout: 10_000,
      },
    });
    console.log(`[DbExecutor] MySQL client created, running query...`);
    try {
      const results = await db.query(sqlStr, params);
      console.log(`[DbExecutor] MySQL query OK, cleaning up connection...`);
      await db.end();
      return results as any[];
    } catch (error: any) {
      if (error.name === "AggregateError" || error instanceof AggregateError) {
        console.error(`[DbExecutor] MySQL query FAILED with AggregateError. Inner errors:`);
        for (const err of error.errors || []) {
          console.error(` - ${err.code}: ${err.message}`);
        }
        await db.quit();
        const messages = (error.errors || []).map((e: any) => e.message).join(", ");
        throw new Error(`Connection failed: ${messages}`);
      } else {
        console.error(`[DbExecutor] MySQL query FAILED:`, error.code, error.message);
        await db.quit();
        throw error;
      }
    }
  }

  private static async executePostgres(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Running query on Postgres...`);
    const sql = postgres({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? "require" : false,
      max: 1,
      idle_timeout: 30,
      connect_timeout: 5,
    });
    try {
      const rows = await sql.unsafe(sqlStr, params as any);
      return rows as any[];
    } finally {
      await sql.end();
    }
  }

  private static async executeMssql(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Getting MSSQL pool...`);
    const pool = await getMssqlPool(config);
    console.log(`[DbExecutor] Running query on MSSQL...`);

    let mssqlQuery = sqlStr;
    const request = pool.request();
    params.forEach((param, i) => {
      const paramName = `p${i + 1}`;
      mssqlQuery = mssqlQuery.replace(`$${i + 1}`, `@${paramName}`);
      request.input(paramName, param);
    });

    const result = await request.query(mssqlQuery);
    return result.recordset;
  }

  private static async executeSqlite(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    if (!config.filePath) throw new Error("SQLite requires a filePath.");
    console.log(`[DbExecutor] Opening SQLite database at: ${config.filePath}`);
    // better-sqlite3 is synchronous — open read-write, throw if file missing
    const db = new Database(config.filePath);
    db.pragma("journal_mode = WAL");
    try {
      const stmt = db.prepare(sqlStr);
      const result = stmt.all(...params);
      return result as any[];
    } finally {
      db.close();
    }
  }
}
