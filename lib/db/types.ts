export interface TableSummary {
  name: string;
  columns: ColumnSummary[];
  isView?: boolean;
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
