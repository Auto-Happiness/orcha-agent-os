import serverlessMysql from 'serverless-mysql';
import postgres from 'postgres';
import * as mssql from 'mssql';
import Database from 'better-sqlite3';

function createSql(config: any) {
  return postgres({
    host: config.host,
    port: parseInt(config.port || '5432'),
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? 'require' : false,
    max: 1,
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

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
        connectTimeout: 10_000,
      }
    });

    try {
      // 1. Get all PRIMARY KEYS for the entire schema at once
      const pkRows: any[] = await db.query(
        `SELECT TABLE_NAME, COLUMN_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE CONSTRAINT_NAME = 'PRIMARY' AND TABLE_SCHEMA = ?`,
        [config.database]
      );

      // Map of TableName -> Set of PK Column Names
      const pksByTable = new Map<string, Set<string>>();
      for (const pk of pkRows) {
        const t = pk.TABLE_NAME || pk.table_name;
        const c = pk.COLUMN_NAME || pk.column_name;
        if (!pksByTable.has(t)) pksByTable.set(t, new Set());
        pksByTable.get(t)!.add(c);
      }

      // 2. Get all COLUMNS for the entire schema at once
      const allColumns: any[] = await db.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = ?
         ORDER BY table_name, ordinal_position`,
        [config.database]
      );

      // Group columns by table
      const columnsByTable = new Map<string, any[]>();
      for (const col of allColumns) {
        const t = col.table_name || col.TABLE_NAME;
        if (!columnsByTable.has(t)) columnsByTable.set(t, []);

        const tablePks = pksByTable.get(t) || new Set();
        columnsByTable.get(t)!.push({
          name: col.column_name || col.COLUMN_NAME,
          dataType: col.data_type || col.DATA_TYPE,
          isPrimary: tablePks.has(col.column_name || col.COLUMN_NAME),
          isNullable: (col.is_nullable || col.IS_NULLABLE) === 'YES',
          defaultValue: col.column_default || col.COLUMN_DEFAULT || undefined,
        });
      }

      const tableSummaries: TableSummary[] = Array.from(columnsByTable.entries()).map(([name, columns]) => ({
        name,
        columns,
      }));

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
    const schemaName = config.schema || 'public';
    const sql = createSql(config);
    try {
      // 1. Get tables
      const tablesRes = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = ${schemaName}
      `;

      const tableSummaries: TableSummary[] = [];

      for (const row of tablesRes) {
        const tableName = row.table_name as string;

        // 2. Get Primary Keys
        const pkRes = await sql`
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = ${tableName}
            AND tc.table_schema = ${schemaName}
        `;
        const pks = new Set(pkRes.map((r: any) => r.column_name));

        // 3. Get columns
        const columnsRes = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = ${schemaName} AND table_name = ${tableName}
        `;

        tableSummaries.push({
          name: tableName,
          columns: columnsRes.map((col: any) => ({
            name: col.column_name,
            dataType: col.data_type,
            isPrimary: pks.has(col.column_name),
            isNullable: col.is_nullable === 'YES',
            defaultValue: col.column_default || undefined,
          })),
        });
      }

      // 4. Get all foreign key relationships
      const fkRes = await sql`
        SELECT
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
          AND tc.table_schema = ${schemaName}
      `;

      const foreignKeys: ForeignKeySummary[] = fkRes.map((fk: any) => ({
        fromTable: fk.from_table,
        fromColumn: fk.from_column,
        toTable: fk.to_table,
        toColumn: fk.to_column,
        constraintName: fk.constraint_name,
      }));

      return { tables: tableSummaries, foreignKeys };
    } finally {
      await sql.end();
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
   * Scans a SQLite database for its schema metadata.
   * Uses sqlite_master for table discovery, PRAGMA table_info for columns,
   * and PRAGMA foreign_key_list for FK relationships.
   */
  static async scanSQLite(config: any): Promise<ScanResult> {
    if (!config.filePath) throw new Error("SQLite requires a filePath.");
    console.log(`[DatabaseScanner] Opening SQLite at: ${config.filePath}`);
    const db = new Database(config.filePath, { readonly: true });
    db.pragma("foreign_keys = ON");

    try {
      // 1. Get all user tables
      const tableRows = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
        .all() as { name: string }[];

      const tableSummaries: TableSummary[] = [];
      const foreignKeys: ForeignKeySummary[] = [];

      for (const { name: tableName } of tableRows) {
        // 2. Get column info via PRAGMA
        const colRows = db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
        const columns: ColumnSummary[] = colRows.map((col) => ({
          name: col.name,
          dataType: col.type || 'TEXT',
          isPrimary: col.pk > 0,
          isNullable: col.notnull === 0,
          defaultValue: col.dflt_value ?? undefined,
        }));

        tableSummaries.push({ name: tableName, columns });

        // 3. Get FK relationships via PRAGMA
        const fkRows = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as any[];
        for (const fk of fkRows) {
          foreignKeys.push({
            fromTable: tableName,
            fromColumn: fk.from,
            toTable: fk.table,
            toColumn: fk.to,
            constraintName: `fk_${tableName}_${fk.from}_${fk.table}`,
          });
        }
      }

      return { tables: tableSummaries, foreignKeys };
    } finally {
      db.close();
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
    } else if (type === "sqlite") {
      if (!config.filePath) throw new Error("SQLite requires a filePath.");
      const db = new Database(config.filePath, { readonly: true });
      try {
        const rows = db.prepare(sqlStr).all() as any[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { rows, columns };
      } finally {
        db.close();
      }
    } else {
      // postgres (porsager) for PostgreSQL
      const sql = createSql(config);
      try {
        const result = await sql.unsafe(sqlStr);
        const rows = result as any[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { rows, columns };
      } finally {
        await sql.end();
      }
    }
  }
}
