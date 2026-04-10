// Inspired by fortune-sheet's cell model
export type Cell = {
  v?: string | number | boolean | null; // raw value
  f?: string;   // formula (starts with =)
  m?: string;   // display/formatted value
  bg?: string;  // background color
  fc?: string;  // font color
  bl?: 0 | 1;   // bold
  it?: 0 | 1;   // italic
  un?: 0 | 1;   // underline
  cl?: 0 | 1;   // strikethrough
  fs?: number;  // font size
  ff?: string;  // font family
  ht?: 1 | 2 | 3; // horizontal align: 1=left 2=center 3=right
  vt?: 1 | 2 | 3; // vertical align: 1=top 2=middle 3=bottom
};

export type CellMatrix = (Cell | null)[][];

export type Selection = {
  row: [number, number];
  col: [number, number];
  rowFocus: number;
  colFocus: number;
};

export type SheetConfig = {
  rowlen: Record<number, number>;
  columnlen: Record<number, number>;
};

export type SheetImage = {
  id: string;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Sheet = {
  id: string;
  name: string;
  data: CellMatrix;
  config: SheetConfig;
  images?: SheetImage[];
};

export const DEFAULT_ROW_HEIGHT = 25;
export const DEFAULT_COL_WIDTH = 100;
export const ROW_HEADER_WIDTH = 46;
export const COL_HEADER_HEIGHT = 24;
export const DEFAULT_ROWS = 100;
export const DEFAULT_COLS = 26;
