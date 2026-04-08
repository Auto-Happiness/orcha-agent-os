import serverlessMysql from "serverless-mysql";
import { Pool as PgPool } from "pg";

export type DbConfig = {
  type: "mysql" | "postgres";
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
};

// Postgres connection pool cache — keyed by connection string
// Reuses pools across requests in the same serverless instance lifetime
const pgPools = new Map<string, PgPool>();

function getPgPool(config: DbConfig): PgPool {
  const key = `${config.host}:${config.port}/${config.database}/${config.user}`;
  if (!pgPools.has(key)) {
    pgPools.set(key, new PgPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,              // max connections per pool
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }));
  }
  return pgPools.get(key)!;
}

export class DbExecutor {
  static async execute(config: DbConfig, sql: string, params: any[] = []): Promise<any[]> {
    if (config.type === "mysql") return this.executeMysql(config, sql, params);
    if (config.type === "postgres") return this.executePostgres(config, sql, params);
    throw new Error(`Unsupported database type: ${config.type}`);
  }

  private static async executeMysql(config: DbConfig, sql: string, params: any[]): Promise<any[]> {
    const db = serverlessMysql({
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5_000,
      },
    });
    try {
      const mysqlSql = sql.replace(/\$\d+/g, "?");
      return (await db.query(mysqlSql, params)) as any[];
    } finally {
      await db.quit();
    }
  }

  private static async executePostgres(config: DbConfig, sql: string, params: any[]): Promise<any[]> {
    const pool = getPgPool(config);
    const client = await pool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows;
    } finally {
      client.release();
    }
  }
}
