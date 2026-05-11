import postgres from 'postgres';
import { ScanResult, TableSummary, ForeignKeySummary, ColumnSummary } from '../types';

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

export class PostgresDialect {
  static async scan(config: any): Promise<ScanResult> {
    const schemaName = config.schema || 'public';
    const sql = createSql(config);
    try {
      // 1. Get tables AND views
      const tablesRes = await sql`
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = ${schemaName}
          AND table_type IN ('BASE TABLE', 'VIEW')
      `;

      const tableTypeMap = new Map<string, boolean>();
      for (const row of tablesRes) {
        tableTypeMap.set(row.table_name as string, row.table_type === 'VIEW');
      }

      // 2. Get all Primary Keys
      const pkRes = await sql`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = ${schemaName}
      `;
      const pksByTable = new Map<string, Set<string>>();
      for (const row of pkRes) {
        if (!pksByTable.has(row.table_name)) pksByTable.set(row.table_name, new Set());
        pksByTable.get(row.table_name)!.add(row.column_name);
      }

      // 3. Get all columns
      const columnsRes = await sql`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = ${schemaName}
        ORDER BY table_name, ordinal_position
      `;
      
      const columnsByTable = new Map<string, ColumnSummary[]>();
      for (const col of columnsRes) {
        if (!columnsByTable.has(col.table_name)) columnsByTable.set(col.table_name, []);
        
        const tablePks = pksByTable.get(col.table_name) || new Set();
        columnsByTable.get(col.table_name)!.push({
          name: col.column_name,
          dataType: col.data_type,
          isPrimary: tablePks.has(col.column_name),
          isNullable: col.is_nullable === 'YES',
          defaultValue: col.column_default || undefined,
        });
      }

      // 4. Construct table summaries
      const tableSummaries: TableSummary[] = Array.from(tableTypeMap.entries()).map(([name, isView]) => ({
        name,
        isView,
        columns: columnsByTable.get(name) || [],
      }));

      // 5. Get all foreign key relationships (tables only; views have no FKs)
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

  static async executeQuery(config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
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
