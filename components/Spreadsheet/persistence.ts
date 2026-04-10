import { Sheet, Cell, DEFAULT_ROWS, DEFAULT_COLS } from "./types";
// Types: Cell has un, cl, ff; Sheet has images — defined in types.ts

export interface SparseCellData {
  r: number;
  c: number;
  v: Cell;
}

export interface PersistedSheet {
  id: string;
  name: string;
  order: number;
  celldata: SparseCellData[];
  columnlen?: Record<number, number>;
  rowlen?: Record<number, number>;
  images?: any[];
}

/** Convert dense CellMatrix → sparse celldata (fortune-sheet style) */
export function sheetToSparse(sheet: Sheet): PersistedSheet {
  const celldata: SparseCellData[] = [];
  sheet.data.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell != null && (cell.v != null || cell.f != null || cell.bg != null || cell.fc != null || cell.bl || cell.it || cell.un || cell.cl || cell.fs || cell.ff || cell.ht || cell.vt)) {
        celldata.push({ r, c, v: cell });
      }
    });
  });
  return {
    id: sheet.id,
    name: sheet.name,
    order: 0,
    celldata,
    columnlen: sheet.config.columnlen as any,
    rowlen: sheet.config.rowlen as any,
    images: sheet.images ?? [],
  };
}

/** Convert sparse celldata → dense CellMatrix */
export function sparseToSheet(persisted: PersistedSheet): Sheet {
  // Find bounds
  let maxRow = DEFAULT_ROWS - 1;
  let maxCol = DEFAULT_COLS - 1;
  persisted.celldata.forEach(({ r, c }) => {
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  });
  const rows = Math.max(maxRow + 10, DEFAULT_ROWS);
  const cols = Math.max(maxCol + 5, DEFAULT_COLS);

  const data: (Cell | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  persisted.celldata.forEach(({ r, c, v }) => {
    if (r < rows && c < cols) data[r][c] = v;
  });

  return {
    id: persisted.id,
    name: persisted.name,
    data,
    config: {
      columnlen: (persisted.columnlen ?? {}) as Record<number, number>,
      rowlen: (persisted.rowlen ?? {}) as Record<number, number>,
    },
    images: persisted.images ?? [],
  };
}
