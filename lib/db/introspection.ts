import serverlessMysql from 'serverless-mysql';
const pg = require('pg');
import type { Client } from 'pg';
const PgClient = pg.Client;
const mssql = require('mssql');

export interface TableSummary {
  name: string;
  columns: ColumnSummary[];
}

export interface ColumnSummary {
  name: string;
  dataType: string;
  isPrimary: boolean;
  isNullable: boolean;
  defaultValue?: string;
}

export interface ForeignKeySummary {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export interface ScanResult {
  tables: TableSummary[];
  foreignKeys: ForeignKeySummary[];
}

// MSSQL connection pool cache for introspection
const mssqlPools = new Map<string, any>();

async function getMssqlPool(config: any): Promise<any> {
  const key = `${config.host}:${config.port || 1433}/${config.database}/${config.user}`;
  if (!mssqlPools.has(key)) {
    const pool = new mssql.ConnectionPool({
      server: config.host,
      port: parseInt(config.port || '1433'),
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
      connectionTimeout: 10_000,
    });
    await pool.connect();
    mssqlPools.set(key, pool);
  }
  return mssqlPools.get(key)!;
}

export class DatabaseScanner {
  /**
   * Scans a MySQL database for its schema metadata.
   */
  static async scanMySQL(config: any): Promise<ScanResult> {
    const db = serverlessMysql({
      config: {
        host: config.host,
        port: parseInt(config.port || '3306'),
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      }
    });

    try {
      // 1. Get all tables in the current database
      const tables: any[] = await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
        [config.database]
      );

      const tableSummaries: TableSummary[] = [];

      for (const tableRow of tables) {
        const tableName = tableRow.table_name || tableRow.TABLE_NAME;
        
        if (!tableName) continue;

        // 2. Get columns for this table
        const columns: any[] = await db.query(
          `SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_key, 
            column_default 
          FROM information_schema.columns 
          WHERE table_schema = ? AND table_name = ?`,
          [config.database, tableName]
        );

        tableSummaries.push({
          name: tableName,
          columns: columns.map((col) => {
            const isKeyPri = (col.column_key || col.COLUMN_KEY) === 'PRI';
            const isNullYes = (col.is_nullable || col.IS_NULLABLE) === 'YES';
            return {
              name: col.column_name || col.COLUMN_NAME,
              dataType: col.data_type || col.DATA_TYPE,
              isPrimary: isKeyPri,
              isNullable: isNullYes,
              defaultValue: col.column_default || col.COLUMN_DEFAULT || undefined,
            };
          }),
        });
      }

      // 3. Get all foreign key relationships
      const fkRows: any[] = await db.query(
        `SELECT 
          TABLE_NAME as from_table,
          COLUMN_NAME as from_column,
          REFERENCED_TABLE_NAME as to_table,
          REFERENCED_COLUMN_NAME as to_column,
          CONSTRAINT_NAME as constraint_name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE REFERENCED_TABLE_NAME IS NOT NULL 
          AND TABLE_SCHEMA = ?`,
        [config.database]
      );

      const foreignKeys: ForeignKeySummary[] = fkRows.map((fk) => ({
        fromTable: fk.from_table || fk.TABLE_NAME,
        fromColumn: fk.from_column || fk.COLUMN_NAME,
        toTable: fk.to_table || fk.REFERENCED_TABLE_NAME,
        toColumn: fk.to_column || fk.REFERENCED_COLUMN_NAME,
        constraintName: fk.constraint_name || fk.CONSTRAINT_NAME,
      }));

      return { tables: tableSummaries, foreignKeys };
    } finally {
      await db.quit();
    }
  }

  /**
   * Scans a PostgreSQL database for its schema metadata.
   */
  static async scanPostgres(config: any): Promise<ScanResult> {
    const client = new PgClient({
      host: config.host,
      port: parseInt(config.port || '5432'),
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });

    await client.connect();
    try {
      // 1. Get tables
      const tablesRes = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );

      const tableSummaries: TableSummary[] = [];

      for (const row of tablesRes.rows) {
        const tableName = row.table_name;
        
        // 2. Get Primary Keys
        const pkRes = await client.query(
          `SELECT kcu.column_name 
           FROM information_schema.table_constraints tc 
           JOIN information_schema.key_column_usage kcu 
             ON tc.constraint_name = kcu.constraint_name 
             AND tc.table_schema = kcu.table_schema 
           WHERE tc.constraint_type = 'PRIMARY KEY' 
           AND tc.table_name = $1 AND tc.table_schema = 'public'`,
          [tableName]
        );
        const pks = new Set(pkRes.rows.map((r: any) => r.column_name));

        // 3. Get columns
        const columnsRes = await client.query(
          `SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1`,
          [tableName]
        );

        tableSummaries.push({
          name: tableName,
          columns: columnsRes.rows.map((col: any) => ({
            name: col.column_name,
            dataType: col.data_type,
            isPrimary: pks.has(col.column_name),
            isNullable: col.is_nullable === 'YES',
            defaultValue: col.column_default || undefined,
          })),
        });
      }

      // 4. Get all foreign key relationships
      const fkRes = await client.query(
        `SELECT
          kcu.table_name AS from_table,
          kcu.column_name AS from_column,
          ccu.table_name AS to_table,
          ccu.column_name AS to_column,
          tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'`
      );

      const foreignKeys: ForeignKeySummary[] = fkRes.rows.map((fk: any) => ({
        fromTable: fk.from_table,
        fromColumn: fk.from_column,
        toTable: fk.to_table,
        toColumn: fk.to_column,
        constraintName: fk.constraint_name,
      }));

      return { tables: tableSummaries, foreignKeys };
    } finally {
      await client.end();
    }
  }

  /**
   * Scans an MSSQL database for its schema metadata.
   */
  static async scanMSSQL(config: any): Promise<ScanResult> {
    const pool = await getMssqlPool(config);
    try {
      // 1. Get tables
      const tablesResult = await pool.request().query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'"
      );

      const tableSummaries: TableSummary[] = [];

      for (const row of tablesResult.recordset) {
        const tableName = row.TABLE_NAME;

        // 2. Get Primary Keys for this table
        const pkResult = await pool.request()
          .input('tableName', tableName)
          .query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
            AND TABLE_NAME = @tableName AND TABLE_SCHEMA = 'dbo'
          `);
        const pks = new Set(pkResult.recordset.map((r: any) => r.COLUMN_NAME));

        // 3. Get columns
        const columnsResult = await pool.request()
          .input('tableName', tableName)
          .query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @tableName AND TABLE_SCHEMA = 'dbo'
          `);

        tableSummaries.push({
          name: tableName,
          columns: columnsResult.recordset.map((col: any) => ({
            name: col.COLUMN_NAME,
            dataType: col.DATA_TYPE,
            isPrimary: pks.has(col.COLUMN_NAME),
            isNullable: col.IS_NULLABLE === 'YES',
            defaultValue: col.COLUMN_DEFAULT || undefined,
          })),
        });
      }

      // 4. Get all foreign key relationships
      const fkResult = await pool.request().query(`
        SELECT
            fk.name AS constraint_name,
            tp.name AS from_table,
            cp.name AS from_column,
            tr.name AS to_table,
            cr.name AS to_column
        FROM sys.foreign_keys AS fk
        INNER JOIN sys.tables AS tp ON fk.parent_object_id = tp.object_id
        INNER JOIN sys.tables AS tr ON fk.referenced_object_id = tr.object_id
        INNER JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.columns AS cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        INNER JOIN sys.columns AS cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      `);

      const foreignKeys: ForeignKeySummary[] = fkResult.recordset.map((fk: any) => ({
        fromTable: fk.from_table,
        fromColumn: fk.from_column,
        toTable: fk.to_table,
        toColumn: fk.to_column,
        constraintName: fk.constraint_name,
      }));

      return { tables: tableSummaries, foreignKeys };
    } catch (err) {
      console.error("MSSQL Introspection failed:", err);
      throw err;
    }
  }

  /**
   * Executes a raw SQL query and returns rows & column definitions.
   */
  static async executeQuery(type: string, config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
    if (type === "mysql") {
      const db = serverlessMysql({
        config: {
          host: config.host,
          port: parseInt(config.port || '3306'),
          user: config.user,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        }
      });
      try {
        const rows: any[] = await db.query(sqlStr);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { rows, columns };
      } finally {
        await db.quit();
      }
    } else if (type === "mssql") {
      const pool = await getMssqlPool(config);
      const result = await pool.request().query(sqlStr);
      const rows = result.recordset;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { rows, columns };
    } else {
      const client = new PgClient({
        host: config.host,
        port: parseInt(config.port || '5432'),
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      });
      await client.connect();
      try {
        const res = await client.query(sqlStr);
        const rows = res.rows;
        const columns = res.fields.map((f: any) => f.name);
        return { rows, columns };
      } finally {
        await client.end();
      }
    }
  }
}
