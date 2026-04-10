import serverlessMysql from "serverless-mysql";
const pg = require("pg");
import type { Pool } from "pg";
const PgPool = pg.Pool;
const mssql = require("mssql");

export type DbConfig = {
  type: "mysql" | "postgres" | "mssql";
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
};

// Postgres connection pool cache
const pgPools = new Map<string, Pool>();

// MSSQL connection pool cache
const mssqlPools = new Map<string, any>();

function getPgPool(config: DbConfig): Pool {
  const key = `${config.host}:${config.port}/${config.database}/${config.user}`;
  if (!pgPools.has(key)) {
    pgPools.set(key, new PgPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }));
  }
  return pgPools.get(key)!;
}

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
        encrypt: true, // Use encryption for Azure/modern instances
        trustServerCertificate: true, // Often needed for self-signed or local dev
      },
      connectionTimeout: 5_000,
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30_000,
      }
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
      console.log(`[DbExecutor] Running query on MySQL...`);
      const results = await db.query(sqlStr, params);
      await db.end();
      return results as any[];
    } catch (error) {
      await db.quit();
      throw error;
    }
  }

  private static async executePostgres(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Getting Postgres pool...`);
    const pool = getPgPool(config);
    console.log(`[DbExecutor] Running query on Postgres...`);
    const client = await pool.connect();
    try {
      const res = await client.query(sqlStr, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  private static async executeMssql(config: DbConfig, sqlStr: string, params: any[]): Promise<any[]> {
    console.log(`[DbExecutor] Getting MSSQL pool...`);
    const pool = await getMssqlPool(config);
    console.log(`[DbExecutor] Running query on MSSQL...`);
    
    // MSSQL driver uses @p1, @p2 etc. instead of $1, $2
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
