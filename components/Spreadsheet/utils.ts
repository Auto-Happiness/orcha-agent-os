import { Sheet, SheetConfig, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, DEFAULT_COLS, DEFAULT_ROWS } from "./types";

export function colIndexToLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function getColWidth(config: SheetConfig, col: number): number {
  return config.columnlen[col] ?? DEFAULT_COL_WIDTH;
}

export function getRowHeight(config: SheetConfig, row: number): number {
  return config.rowlen[row] ?? DEFAULT_ROW_HEIGHT;
}

// Cumulative pixel offsets for rows/cols — used for hit testing and rendering
export function buildOffsets(
  count: number,
  getSizeAt: (i: number) => number
): number[] {
  const offsets = new Array(count + 1);
  offsets[0] = 0;
  for (let i = 0; i < count; i++) {
    offsets[i + 1] = offsets[i] + getSizeAt(i);
  }
  return offsets;
}

// Binary search: find which row/col a pixel falls in
export function hitTest(offsets: number[], px: number): number {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (px < offsets[mid]) hi = mid - 1;
    else if (px >= offsets[mid + 1]) lo = mid + 1;
    else return mid;
  }
  return Math.max(0, offsets.length - 2);
}

export function makeEmptySheet(name = "Sheet1", id?: string): Sheet {
  return {
    id: id ?? crypto.randomUUID(),
    name,
    data: Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill(null)),
    config: { rowlen: {}, columnlen: {} },
  };
}

// Cell address like "A1", "B3"
export function cellAddress(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}
