import * as mssql from 'mssql';
import { ScanResult, TableSummary, ForeignKeySummary, ColumnSummary } from '../types';

// MSSQL connection pool cache for introspection
const mssqlPools = new Map<string, any>();

async function getMssqlPool(config: any): Promise<any> {
  const key = `${config.host}:${config.port || 1433}/${config.database}/${config.user}/${config.instanceName || ""}`;
  if (!mssqlPools.has(key)) {
    const pool = new mssql.ConnectionPool({
      server: config.host,
      port: parseInt(config.port || '1433'),
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt: config.encrypt ?? config.ssl ?? true,
        trustServerCertificate: config.trustServerCertificate ?? true,
        instanceName: config.instanceName,
      },
      connectionTimeout: 10_000,
    });
    await pool.connect();
    mssqlPools.set(key, pool);
  }
  return mssqlPools.get(key)!;
}

export class MSSQLDialect {
  static async scan(config: any): Promise<ScanResult> {
    const pool = await getMssqlPool(config);
    try {
      // 1. Get tables AND views
      const objectsResult = await pool.request().query(`
        SELECT TABLE_NAME, TABLE_TYPE 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'dbo' 
          AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      `);
      const tableTypeMap = new Map<string, boolean>();
      for (const r of objectsResult.recordset) {
        tableTypeMap.set(r.TABLE_NAME, r.TABLE_TYPE === 'VIEW');
      }

      // 2. Get all Primary Keys
      const pkResult = await pool.request().query(`
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
          AND TABLE_SCHEMA = 'dbo'
      `);
      const pksByTable = new Map<string, Set<string>>();
      for (const r of pkResult.recordset) {
        if (!pksByTable.has(r.TABLE_NAME)) pksByTable.set(r.TABLE_NAME, new Set());
        pksByTable.get(r.TABLE_NAME)!.add(r.COLUMN_NAME);
      }

      // 3. Get all columns
      const columnsResult = await pool.request().query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `);
      const columnsByTable = new Map<string, ColumnSummary[]>();
      for (const col of columnsResult.recordset) {
        if (!columnsByTable.has(col.TABLE_NAME)) columnsByTable.set(col.TABLE_NAME, []);
        
        const tablePks = pksByTable.get(col.TABLE_NAME) || new Set();
        columnsByTable.get(col.TABLE_NAME)!.push({
          name: col.COLUMN_NAME,
          dataType: col.DATA_TYPE,
          isPrimary: tablePks.has(col.COLUMN_NAME),
          isNullable: col.IS_NULLABLE === 'YES',
          defaultValue: col.COLUMN_DEFAULT || undefined,
        });
      }

      // 4. Construct table summaries
      const tableSummaries: TableSummary[] = Array.from(tableTypeMap.entries()).map(([name, isView]) => ({
        name,
        isView,
        columns: columnsByTable.get(name) || [],
      }));

      // 5. Get all foreign key relationships (tables only; views have no FKs)
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

  static async executeQuery(config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
    const pool = await getMssqlPool(config);
    const result = await pool.request().query(sqlStr);
    const rows = result.recordset;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns };
  }
}
