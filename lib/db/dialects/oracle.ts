import { ScanResult, TableSummary, ForeignKeySummary, ColumnSummary } from '../types';

export class OracleDialect {
  private static getOracledb() {
    // Dynamically load node-oracledb to avoid static bundling or load issues
    return require('oracledb');
  }

  private static getConnectionAttrs(config: any) {
    const connAttrs: any = {
      user: config.user,
      password: config.password,
    };

    if (config.connectString) {
      connAttrs.connectString = config.connectString;
    } else {
      connAttrs.connectString = `${config.host}:${config.port || 1521}/${config.database}`;
    }

    return connAttrs;
  }

  static async scan(config: any): Promise<ScanResult> {
    const oracledb = this.getOracledb();
    const connAttrs = this.getConnectionAttrs(config);
    const useSchema = config.schema ? config.schema.toUpperCase() : null;
    const defaultSchema = config.user ? config.user.toUpperCase() : null;
    const targetSchema = useSchema || defaultSchema;

    const isUserSchemaOnly = !useSchema || useSchema === defaultSchema;

    console.log(`[OracleDialect] Scanning database. Target schema: ${targetSchema}, isUserSchemaOnly: ${isUserSchemaOnly}`);

    let connection;
    try {
      connection = await oracledb.getConnection(connAttrs);

      const tableTypeMap = new Map<string, boolean>(); // tableName -> isView
      const pksByTable = new Map<string, Set<string>>(); // tableName -> Set of pkColumnNames
      const columnsByTable = new Map<string, ColumnSummary[]>(); // tableName -> ColumnSummary[]
      const foreignKeys: ForeignKeySummary[] = [];

      // 1. Get Tables and Views
      if (isUserSchemaOnly) {
        // Query user tables
        const tablesRes = await connection.execute(
          `SELECT table_name FROM user_tables`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (tablesRes.rows || [])) {
          tableTypeMap.set(row.TABLE_NAME, false);
        }

        // Query user views
        const viewsRes = await connection.execute(
          `SELECT view_name FROM user_views`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (viewsRes.rows || [])) {
          tableTypeMap.set(row.VIEW_NAME, true);
        }
      } else {
        // Query all tables for specific schema
        const tablesRes = await connection.execute(
          `SELECT table_name FROM all_tables WHERE owner = :schema`,
          [targetSchema],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (tablesRes.rows || [])) {
          tableTypeMap.set(row.TABLE_NAME, false);
        }

        // Query all views for specific schema
        const viewsRes = await connection.execute(
          `SELECT view_name FROM all_views WHERE owner = :schema`,
          [targetSchema],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (viewsRes.rows || [])) {
          tableTypeMap.set(row.VIEW_NAME, true);
        }
      }

      // 2. Get Primary Keys
      if (isUserSchemaOnly) {
        const pkRes = await connection.execute(
          `SELECT cols.table_name, cols.column_name
           FROM user_constraints cons
           JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
           WHERE cons.constraint_type = 'P'`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (pkRes.rows || [])) {
          if (!pksByTable.has(row.TABLE_NAME)) {
            pksByTable.set(row.TABLE_NAME, new Set());
          }
          pksByTable.get(row.TABLE_NAME)!.add(row.COLUMN_NAME);
        }
      } else {
        const pkRes = await connection.execute(
          `SELECT cols.table_name, cols.column_name
           FROM all_constraints cons
           JOIN all_cons_columns cols ON cons.owner = cols.owner AND cons.constraint_name = cols.constraint_name
           WHERE cons.constraint_type = 'P' AND cons.owner = :schema`,
          [targetSchema],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (pkRes.rows || [])) {
          if (!pksByTable.has(row.TABLE_NAME)) {
            pksByTable.set(row.TABLE_NAME, new Set());
          }
          pksByTable.get(row.TABLE_NAME)!.add(row.COLUMN_NAME);
        }
      }

      // 3. Get Columns
      if (isUserSchemaOnly) {
        const colsRes = await connection.execute(
          `SELECT table_name, column_name, data_type, nullable, data_default
           FROM user_tab_cols
           WHERE hidden_column = 'NO'
           ORDER BY table_name, column_id`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const col of (colsRes.rows || [])) {
          if (!columnsByTable.has(col.TABLE_NAME)) {
            columnsByTable.set(col.TABLE_NAME, []);
          }
          const tablePks = pksByTable.get(col.TABLE_NAME) || new Set();
          columnsByTable.get(col.TABLE_NAME)!.push({
            name: col.COLUMN_NAME,
            dataType: col.DATA_TYPE,
            isPrimary: tablePks.has(col.COLUMN_NAME),
            isNullable: col.NULLABLE === 'Y',
            defaultValue: col.DATA_DEFAULT ? String(col.DATA_DEFAULT).trim() : undefined,
          });
        }
      } else {
        const colsRes = await connection.execute(
          `SELECT table_name, column_name, data_type, nullable, data_default
           FROM all_tab_cols
           WHERE owner = :schema AND hidden_column = 'NO'
           ORDER BY table_name, column_id`,
          [targetSchema],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const col of (colsRes.rows || [])) {
          if (!columnsByTable.has(col.TABLE_NAME)) {
            columnsByTable.set(col.TABLE_NAME, []);
          }
          const tablePks = pksByTable.get(col.TABLE_NAME) || new Set();
          columnsByTable.get(col.TABLE_NAME)!.push({
            name: col.COLUMN_NAME,
            dataType: col.DATA_TYPE,
            isPrimary: tablePks.has(col.COLUMN_NAME),
            isNullable: col.NULLABLE === 'Y',
            defaultValue: col.DATA_DEFAULT ? String(col.DATA_DEFAULT).trim() : undefined,
          });
        }
      }

      // 4. Construct table summaries
      const tableSummaries: TableSummary[] = Array.from(tableTypeMap.entries()).map(([name, isView]) => ({
        name,
        isView,
        columns: columnsByTable.get(name) || [],
      }));

      // 5. Get Foreign Keys
      if (isUserSchemaOnly) {
        const fkRes = await connection.execute(
          `SELECT 
             c.constraint_name,
             c.table_name AS from_table,
             col.column_name AS from_column,
             r.table_name AS to_table,
             r_col.column_name AS to_column
           FROM user_constraints c
           JOIN user_cons_columns col ON c.constraint_name = col.constraint_name
           JOIN user_constraints r ON c.r_constraint_name = r.constraint_name
           JOIN user_cons_columns r_col ON r.constraint_name = r_col.constraint_name AND col.position = r_col.position
           WHERE c.constraint_type = 'R'`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (fkRes.rows || [])) {
          foreignKeys.push({
            fromTable: row.FROM_TABLE,
            fromColumn: row.FROM_COLUMN,
            toTable: row.TO_TABLE,
            toColumn: row.TO_COLUMN,
            constraintName: row.CONSTRAINT_NAME,
          });
        }
      } else {
        const fkRes = await connection.execute(
          `SELECT 
             c.constraint_name,
             c.table_name AS from_table,
             col.column_name AS from_column,
             r.table_name AS to_table,
             r_col.column_name AS to_column
           FROM all_constraints c
           JOIN all_cons_columns col ON c.owner = col.owner AND c.constraint_name = col.constraint_name
           JOIN all_constraints r ON c.r_owner = r.owner AND c.r_constraint_name = r.constraint_name
           JOIN all_cons_columns r_col ON r.owner = r_col.owner AND r.constraint_name = r_col.constraint_name AND col.position = r_col.position
           WHERE c.constraint_type = 'R' AND c.owner = :schema`,
          [targetSchema],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        for (const row of (fkRes.rows || [])) {
          foreignKeys.push({
            fromTable: row.FROM_TABLE,
            fromColumn: row.FROM_COLUMN,
            toTable: row.TO_TABLE,
            toColumn: row.TO_COLUMN,
            constraintName: row.CONSTRAINT_NAME,
          });
        }
      }

      return { tables: tableSummaries, foreignKeys };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error('[OracleDialect] Error closing connection:', err);
        }
      }
    }
  }

  static async executeQuery(config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
    const oracledb = this.getOracledb();
    const connAttrs = this.getConnectionAttrs(config);

    let connection;
    try {
      connection = await oracledb.getConnection(connAttrs);
      // Run the query
      const result = await connection.execute(sqlStr, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });

      const rows = result.rows || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { rows, columns };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error('[OracleDialect] Error closing connection:', err);
        }
      }
    }
  }
}
