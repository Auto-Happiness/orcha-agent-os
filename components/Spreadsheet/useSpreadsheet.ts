import { useState, useCallback, useRef, useMemo } from "react";
import { ColDef, CellValue, SpreadsheetRow } from "./types";
import { HyperFormula } from "hyperformula";

const DEFAULT_COLS = 10;
const DEFAULT_ROWS = 50;

export function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function makeDefaultCols(count: number): ColDef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: colLetter(i),
    name: colLetter(i),
    width: 120,
  }));
}

function makeDefaultRows(cols: ColDef[], count: number): SpreadsheetRow[] {
  return Array.from({ length: count }, () =>
    Object.fromEntries(cols.map((c) => [c.key, null]))
  );
}

export function useSpreadsheet() {
  const [cols, setCols] = useState<ColDef[]>(() => makeDefaultCols(DEFAULT_COLS));
  const [rows, setRows] = useState<SpreadsheetRow[]>(() =>
    makeDefaultRows(makeDefaultCols(DEFAULT_COLS), DEFAULT_ROWS)
  );

  // Single persistent HyperFormula instance — rebuilt only when data changes
  const hfRef = useRef<HyperFormula | null>(null);

  const getHF = useCallback((currentRows: SpreadsheetRow[], currentCols: ColDef[]) => {
    const data = currentRows.map((r) => currentCols.map((c) => r[c.key] ?? null));
    if (!hfRef.current) {
      hfRef.current = HyperFormula.buildFromArray(data, { licenseKey: "gpl-v3" });
    } else {
      // Update existing instance in-place — much faster than rebuild
      hfRef.current.setSheetContent(0, data);
    }
    return hfRef.current;
  }, []);

  // Precomputed evaluated values — only recalculated when rows/cols change
  const evaluatedGrid = useMemo(() => {
    const hasFormulas = rows.some((r) =>
      cols.some((c) => typeof r[c.key] === "string" && (r[c.key] as string).startsWith("="))
    );

    if (!hasFormulas) {
      // Fast path: no formulas, return raw values
      return rows.map((r) => Object.fromEntries(cols.map((c) => [c.key, r[c.key]])));
    }

    const hf = getHF(rows, cols);
    return rows.map((r, ri) =>
      Object.fromEntries(
        cols.map((c, ci) => {
          const raw = r[c.key];
          if (typeof raw === "string" && raw.startsWith("=")) {
            try {
              const val = hf.getCellValue({ sheet: 0, row: ri, col: ci });
              return [c.key, val as CellValue];
            } catch {
              return [c.key, "#ERR"];
            }
          }
          return [c.key, raw];
        })
      )
    );
  }, [rows, cols, getHF]);

  const updateCell = useCallback((rowIdx: number, colKey: string, value: CellValue) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [colKey]: value };
      return next;
    });
  }, []);

  const resizeCol = useCallback((colKey: string, width: number) => {
    setCols((prev) => prev.map((c) => (c.key === colKey ? { ...c, width } : c)));
  }, []);

  const addCol = useCallback(() => {
    setCols((prev) => {
      const newKey = colLetter(prev.length);
      const newCol: ColDef = { key: newKey, name: newKey, width: 120 };
      setRows((r) => r.map((row) => ({ ...row, [newKey]: null })));
      return [...prev, newCol];
    });
  }, []);

  const addRow = useCallback(() => {
    setCols((currentCols) => {
      setRows((prev) => [...prev, Object.fromEntries(currentCols.map((c) => [c.key, null]))]);
      return currentCols;
    });
  }, []);

  const loadData = useCallback((newCols: ColDef[], newRows: SpreadsheetRow[]) => {
    hfRef.current = null; // force HF rebuild on next access
    setCols(newCols);
    setRows(newRows);
  }, []);

  return { cols, rows, evaluatedGrid, updateCell, resizeCol, addCol, addRow, loadData };
}
