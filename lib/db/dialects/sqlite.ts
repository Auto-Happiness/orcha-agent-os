import Database from 'better-sqlite3';
import { ScanResult, TableSummary, ForeignKeySummary, ColumnSummary } from '../types';

export class SQLiteDialect {
  static async scan(config: any): Promise<ScanResult> {
    if (!config.filePath) throw new Error("SQLite requires a filePath.");
    console.log(`[DatabaseScanner] Opening SQLite at: ${config.filePath}`);
    const db = new Database(config.filePath, { readonly: true });
    db.pragma("foreign_keys = ON");

    try {
      // 1. Get all user tables AND views
      const objectRows = db
        .prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`)
        .all() as { name: string; type: string }[];

      const tableSummaries: TableSummary[] = [];
      const foreignKeys: ForeignKeySummary[] = [];

      for (const { name: tableName, type: objType } of objectRows) {
        const isView = objType === 'view';

        // 2. Get column info via PRAGMA (works for both tables and views)
        const colRows = db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
        const columns: ColumnSummary[] = colRows.map((col) => ({
          name: col.name,
          dataType: col.type || 'TEXT',
          isPrimary: col.pk > 0,
          isNullable: col.notnull === 0,
          defaultValue: col.dflt_value ?? undefined,
        }));

        tableSummaries.push({ name: tableName, isView, columns });

        // 3. Get FK relationships via PRAGMA (views have no FKs)
        if (!isView) {
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
      }

      return { tables: tableSummaries, foreignKeys };
    } finally {
      db.close();
    }
  }

  static async executeQuery(config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
    if (!config.filePath) throw new Error("SQLite requires a filePath.");
    const db = new Database(config.filePath, { readonly: true });
    try {
      const rows = db.prepare(sqlStr).all() as any[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { rows, columns };
    } finally {
      db.close();
    }
  }
}
