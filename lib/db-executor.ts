import serverlessMysql from 'serverless-mysql';
import { Client as PgClient } from 'pg';

export type DbConfig = {
  type: 'mysql' | 'postgres';
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
};

export class DbExecutor {
  /**
   * execute
   * 
   * Connects to the database, executes the SQL statement with parameters,
   * and returns the result as an array of objects.
   */
  static async execute(config: DbConfig, sql: string, params: any[] = []): Promise<any[]> {
    if (config.type === 'mysql') {
      return this.executeMysql(config, sql, params);
    } else if (config.type === 'postgres') {
      return this.executePostgres(config, sql, params);
    } else {
      throw new Error(`Unsupported database type: ${config.type}`);
    }
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
      }
    });

    try {
      // Convert $1, $2 (Postgres style) to ? (MySQL style) if necessary
      const mysqlSql = sql.replace(/\$\d+/g, '?');
      const results = await db.query(mysqlSql, params);
      return results as any[];
    } finally {
      await db.quit();
    }
  }

  private static async executePostgres(config: DbConfig, sql: string, params: any[]): Promise<any[]> {
    const client = new PgClient({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });

    await client.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows;
    } finally {
      await client.end();
    }
  }
}
