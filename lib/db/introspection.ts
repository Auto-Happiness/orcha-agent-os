import serverlessMysql from 'serverless-mysql';
import { Client as PgClient } from 'pg';

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
        const pks = new Set(pkRes.rows.map(r => r.column_name));

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
   * Executes a raw SQL query and returns rows & column definitions.
   */
  static async executeQuery(type: string, config: any, sql: string): Promise<{ rows: any[], columns: string[] }> {
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
        const rows: any[] = await db.query(sql);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { rows, columns };
      } finally {
        await db.quit();
      }
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
        const res = await client.query(sql);
        const rows = res.rows;
        const columns = res.fields.map(f => f.name);
        return { rows, columns };
      } finally {
        await client.end();
      }
    }
  }
}
