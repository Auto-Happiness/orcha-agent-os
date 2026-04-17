import postgres from "postgres";
import serverlessMysql from "serverless-mysql";
import * as mssql from "mssql";

export type DbConfig = {
  type: "mysql" | "postgres" | "mssql";
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  schema?: string;
  ssl?: boolean;
};

// MSSQL connection pool cache
const mssqlPools = new Map<string, any>();

async function getMssqlPool(config: DbConfig): Promise<any> {
  const key = `${config.host}:${config.port}/${config.database}/${config.user}`;
  if (!mssqlPools.has(key)) {
    console.log(`[DbExecutor] Connecting to MSSQL: ${config.host}:${config.port}...`);
    const pool = new mssql.ConnectionPool({
      server: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
      connectionTimeout: 5_000,
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
      throw new Error(`Unsupported database type: ${config.type}`);
    } catch (err: any) {
      console.error(`[DbExecutor] ${config.type} execution error:`, err.message);
      throw err;
    }
  }

  private static async executeMysql(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Connecting to MySQL...`);
    const db = serverlessMysql({
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      },
    });
    try {
      const results = await db.query(sqlStr, params);
      await db.end();
      return results as any[];
    } catch (error) {
      await db.quit();
      throw error;
    }
  }

  private static async executePostgres(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Running query on Postgres...`);
    // 'postgres' (porsager) is ESM-native — no Turbopack interop issues
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
}
