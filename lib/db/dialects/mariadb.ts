import serverlessMysql from 'serverless-mysql';
import { ScanResult, TableSummary, ForeignKeySummary } from '../types';

export class MariaDBDialect {
  static async scan(config: any): Promise<ScanResult> {
    console.log(`[MariaDBDialect] Scanning database metadata for ${config.database}...`);
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

      // 2. Discover all tables AND views
      const tableTypeRows: any[] = await db.query(
        `SELECT TABLE_NAME, TABLE_TYPE
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')`,
        [config.database]
      );
      const tableTypeMap = new Map<string, boolean>(); // name -> isView
      for (const r of tableTypeRows) {
        const name = r.TABLE_NAME || r.table_name;
        tableTypeMap.set(name, (r.TABLE_TYPE || r.table_type) === 'VIEW');
      }

      // 3. Get all COLUMNS for the entire schema at once
      const allColumns: any[] = await db.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = ?
         ORDER BY table_name, ordinal_position`,
         [config.database]
      );

      // Group columns by table/view
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
        isView: tableTypeMap.get(name) ?? false,
      }));

      // 4. Get all foreign key relationships (tables only; views have no FKs)
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

  static async executeQuery(config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
    console.log(`[MariaDBDialect] Executing query against ${config.database}...`);
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
  }
}
