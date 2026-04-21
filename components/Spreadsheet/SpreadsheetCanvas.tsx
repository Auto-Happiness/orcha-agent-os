"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react";
import {
  Sheet, Selection, Cell,
  DEFAULT_ROW_HEIGHT, DEFAULT_COL_WIDTH,
  ROW_HEADER_WIDTH, COL_HEADER_HEIGHT,
} from "./types";
import { buildOffsets, getColWidth, getRowHeight, hitTest, colIndexToLetter } from "./utils";
import { evalFormula } from "./formulaEngine";

interface Props {
  sheet: Sheet;
  selection: Selection | null;
  editingCell: { row: number; col: number } | null;
  onSelectCell: (row: number, col: number, extend?: boolean) => void;
  onSelectFullColumn: (col: number) => void;
  onSelectFullRow: (row: number) => void;
  onSelectAll: () => void;
  onStartEdit: (row: number, col: number) => void;
  onResizeCol: (col: number, width: number) => void;
  onResizeRow: (row: number, height: number) => void;
  onHeaderContextMenu: (type: "row" | "col", index: number, x: number, y: number) => void;
  onCellContextMenu: (row: number, col: number, x: number, y: number) => void;
  onMoveCells: (source: Selection, targetRow: number, targetCol: number) => void;
  scrollLeft: number;
  scrollTop: number;
}

export interface CanvasHandle {
  redraw: () => void;
}

const COLORS = {
  bg: "#07050f",
  headerBg: "#0f0c1e",
  headerText: "rgba(192,132,252,0.8)",
  border: "rgba(255,255,255,0.06)",
  headerBorder: "rgba(147,51,234,0.2)",
  selectionFill: "rgba(147,51,234,0.12)",
  selectionBorder: "#a855f7",
  cellText: "rgba(255,255,255,0.85)",
  numText: "#a5f3fc",
  dimText: "rgba(255,255,255,0.2)",
  rowStripe: "rgba(255,255,255,0.012)",
};

const SpreadsheetCanvas = forwardRef<CanvasHandle, Props>(function SpreadsheetCanvas(
  { sheet, selection, editingCell, onSelectCell,
  onSelectFullColumn,
  onSelectFullRow,
  onSelectAll,
  onStartEdit,
 onResizeCol, onResizeRow, onHeaderContextMenu, onCellContextMenu, onMoveCells, scrollLeft, scrollTop },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Resize & Drag state
  const resizing = useRef<{ type: "col" | "row"; index: number; startPx: number; startSize: number } | null>(null);
  const dragging = useRef<boolean>(false);
  const [dragTarget, setDragTarget] = useState<{ row: number; col: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const { data, config } = sheet;
    const rows = data.length;
    const cols = data[0]?.length ?? 0;

    const rowOffsets = buildOffsets(rows, r => getRowHeight(config, r));
    const colOffsets = buildOffsets(cols, c => getColWidth(config, c));

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Find visible range
    const visColStart = hitTest(colOffsets, scrollLeft);
    const visColEnd = Math.min(cols - 1, hitTest(colOffsets, scrollLeft + W - ROW_HEADER_WIDTH) + 1);
    const visRowStart = hitTest(rowOffsets, scrollTop);
    const visRowEnd = Math.min(rows - 1, hitTest(rowOffsets, scrollTop + H - COL_HEADER_HEIGHT) + 1);

    const toX = (c: number) => ROW_HEADER_WIDTH + colOffsets[c] - scrollLeft;
    const toY = (r: number) => COL_HEADER_HEIGHT + rowOffsets[r] - scrollTop;

    // ── Draw cells ──────────────────────────────────────────────────────────
    ctx.save();
    ctx.rect(ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, W - ROW_HEADER_WIDTH, H - COL_HEADER_HEIGHT);
    ctx.clip();

    for (let r = visRowStart; r <= visRowEnd; r++) {
      for (let c = visColStart; c <= visColEnd; c++) {
        const x = toX(c);
        const y = toY(r);
        const w = getColWidth(config, c);
        const h = getRowHeight(config, r);

        const cell: Cell | null = data[r]?.[c] ?? null;
        const isSelected = selection &&
          r >= selection.row[0] && r <= selection.row[1] &&
          c >= selection.col[0] && c <= selection.col[1];
        const isEditing = editingCell?.row === r && editingCell?.col === c;

        // Cell background
        const bg = cell?.bg ?? (isSelected ? COLORS.selectionFill : r % 2 === 1 ? COLORS.rowStripe : "transparent");
        if (bg !== "transparent") {
          ctx.fillStyle = isSelected ? COLORS.selectionFill : bg;
          ctx.fillRect(x, y, w, h);
        } else if (isSelected) {
          ctx.fillStyle = COLORS.selectionFill;
          ctx.fillRect(x, y, w, h);
        }

        // Cell border
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // Cell value
        if (!isEditing && cell) {
          let displayVal: string;
          const raw = cell.f ? evalFormula(cell.f, data) : cell.v;

          if (cell.format) {
            const format = cell.format;
            try {
              if (format === "percent") {
                displayVal = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(Number(raw));
              } else if (format === "currency") {
                displayVal = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(raw));
              } else if (format === "decimal2") {
                displayVal = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(raw));
              } else if (format === "date-short") {
                displayVal = new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(new Date(raw as string));
              } else if (format === "date-long") {
                displayVal = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(raw as string));
              } else {
                displayVal = cell.m ?? String(raw ?? "");
              }
            } catch (e) {
              displayVal = cell.m ?? String(raw ?? "");
            }
          } else {
            displayVal = cell.m ?? String(raw ?? "");
          }

          if (displayVal) {
            const isNum = !isNaN(Number(displayVal)) && displayVal !== "";
            const fontSize = cell.fs ?? 12;
            const fontFamily = cell.ff ? String(cell.ff) : "-apple-system, sans-serif";
            ctx.fillStyle = cell.fc ?? (isNum ? COLORS.numText : COLORS.cellText);
            ctx.font = `${cell.it ? "italic " : ""}${cell.bl ? "bold " : ""}${fontSize}px ${fontFamily}`;

            // Horizontal align
            const hAlign = cell.ht ?? (isNum ? 3 : 1);
            ctx.textAlign = hAlign === 3 ? "right" : hAlign === 2 ? "center" : "left";
            const textX = hAlign === 3 ? x + w - 6 : hAlign === 2 ? x + w / 2 : x + 6;

            // Vertical align
            const vAlign = cell.vt ?? 2; // default middle
            ctx.textBaseline = vAlign === 1 ? "top" : vAlign === 3 ? "bottom" : "middle";
            const textY = vAlign === 1 ? y + 4 : vAlign === 3 ? y + h - 4 : y + h / 2;

            ctx.save();
            ctx.rect(x + 1, y + 1, w - 2, h - 2);
            ctx.clip();
            ctx.fillText(displayVal, textX, textY);

            // Underline
            if (cell.un) {
              const metrics = ctx.measureText(displayVal);
              const tw = Math.min(metrics.width, w - 12);
              const ux = hAlign === 3 ? textX - tw : hAlign === 2 ? textX - tw / 2 : textX;
              const uy = textY + fontSize * 0.15;
              ctx.strokeStyle = cell.fc ?? COLORS.cellText;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(ux, uy);
              ctx.lineTo(ux + tw, uy);
              ctx.stroke();
            }

            // Strikethrough
            if (cell.cl) {
              const metrics = ctx.measureText(displayVal);
              const tw = Math.min(metrics.width, w - 12);
              const sx2 = hAlign === 3 ? textX - tw : hAlign === 2 ? textX - tw / 2 : textX;
              const sy2 = textY - fontSize * 0.05;
              ctx.strokeStyle = cell.fc ?? COLORS.cellText;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(sx2, sy2);
              ctx.lineTo(sx2 + tw, sy2);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }
    }

    // Selection border
    if (selection) {
      const sx = toX(selection.col[0]);
      const sy = toY(selection.row[0]);
      const sw = colOffsets[selection.col[1] + 1] - colOffsets[selection.col[0]];
      const sh = rowOffsets[selection.row[1] + 1] - rowOffsets[selection.row[0]];
      ctx.strokeStyle = COLORS.selectionBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
    }

    // Drag ghost
    if (dragTarget && selection) {
      const numRows = selection.row[1] - selection.row[0] + 1;
      const numCols = selection.col[1] - selection.col[0] + 1;
      const gx = toX(dragTarget.col);
      const gy = toY(dragTarget.row);
      const gw = colOffsets[Math.min(cols, dragTarget.col + numCols)] - colOffsets[dragTarget.col];
      const gh = rowOffsets[Math.min(rows, dragTarget.row + numRows)] - rowOffsets[dragTarget.row];
      ctx.strokeStyle = COLORS.selectionBorder;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx + 1, gy + 1, gw - 2, gh - 2);
      ctx.setLineDash([]);
    }

    ctx.restore();

    // ── Column headers ──────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(ROW_HEADER_WIDTH, 0, W, COL_HEADER_HEIGHT);

    for (let c = visColStart; c <= visColEnd; c++) {
      const x = toX(c);
      const w = getColWidth(config, c);
      const isColSelected = selection && c >= selection.col[0] && c <= selection.col[1];

      if (isColSelected) {
        ctx.fillStyle = "rgba(147,51,234,0.15)";
        ctx.fillRect(x, 0, w, COL_HEADER_HEIGHT);
      }

      ctx.strokeStyle = COLORS.headerBorder;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, 0.5, w - 1, COL_HEADER_HEIGHT - 1);

      ctx.fillStyle = COLORS.headerText;
      ctx.font = "bold 11px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(colIndexToLetter(c), x + w / 2, COL_HEADER_HEIGHT / 2);

      // Resize handle indicator
      ctx.fillStyle = "rgba(147,51,234,0.4)";
      ctx.fillRect(x + w - 2, 2, 2, COL_HEADER_HEIGHT - 4);
    }

    // ── Row headers ─────────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, H);

    for (let r = visRowStart; r <= visRowEnd; r++) {
      const y = toY(r);
      const h = getRowHeight(config, r);
      const isRowSelected = selection && r >= selection.row[0] && r <= selection.row[1];

      if (isRowSelected) {
        ctx.fillStyle = "rgba(147,51,234,0.15)";
        ctx.fillRect(0, y, ROW_HEADER_WIDTH, h);
      }

      ctx.strokeStyle = COLORS.headerBorder;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0.5, y + 0.5, ROW_HEADER_WIDTH - 1, h - 1);

      ctx.fillStyle = COLORS.dimText;
      ctx.font = "10px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(r + 1), ROW_HEADER_WIDTH - 6, y + h / 2);
    }

    // Corner
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);
    ctx.strokeStyle = COLORS.headerBorder;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.5, 0.5, ROW_HEADER_WIDTH - 1, COL_HEADER_HEIGHT - 1);

  }, [sheet, selection, editingCell, scrollLeft, scrollTop, dpr, dragTarget]);

  useEffect(() => { draw(); }, [draw]);

  useImperativeHandle(ref, () => ({ redraw: draw }));

  // ── Mouse events ────────────────────────────────────────────────────────
  const getCell = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return null;

    const { config, data } = sheet;
    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    const rowOffsets = buildOffsets(rows, r => getRowHeight(config, r));
    const colOffsets = buildOffsets(cols, c => getColWidth(config, c));

    const col = hitTest(colOffsets, x - ROW_HEADER_WIDTH + scrollLeft);
    const row = hitTest(rowOffsets, y - COL_HEADER_HEIGHT + scrollTop);
    return { row, col };
  }, [sheet, scrollLeft, scrollTop]);

  const getColResizeHandle = useCallback((clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (y > COL_HEADER_HEIGHT) return null;

    const { config, data } = sheet;
    const cols = data[0]?.length ?? 0;
    const colOffsets = buildOffsets(cols, c => getColWidth(config, c));

    for (let c = 0; c < cols; c++) {
      const edgeX = ROW_HEADER_WIDTH + colOffsets[c + 1] - scrollLeft;
      if (Math.abs(x - edgeX) <= 4) return c;
    }
    return null;
  }, [sheet, scrollLeft]);

  const isOnSelectionBorder = useCallback((clientX: number, clientY: number) => {
    if (!selection || !canvasRef.current) return false;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { config, data } = sheet;
    const rowOffsets = buildOffsets(data.length, r => getRowHeight(config, r));
    const colOffsets = buildOffsets(data[0]?.length ?? 0, c => getColWidth(config, c));
    const sx = ROW_HEADER_WIDTH + colOffsets[selection.col[0]] - scrollLeft;
    const sy = COL_HEADER_HEIGHT + rowOffsets[selection.row[0]] - scrollTop;
    const sw = colOffsets[selection.col[1] + 1] - colOffsets[selection.col[0]];
    const sh = rowOffsets[selection.row[1] + 1] - rowOffsets[selection.row[0]];
    const margin = 5;
    const onTop = y >= sy - margin && y <= sy + margin && x >= sx && x <= sx + sw;
    const onBottom = y >= sy + sh - margin && y <= sy + sh + margin && x >= sx && x <= sx + sw;
    const onLeft = x >= sx - margin && x <= sx + margin && y >= sy && y <= sy + sh;
    const onRight = x >= sx + sw - margin && x <= sx + sw + margin && y >= sy && y <= sy + sh;
    return onTop || onBottom || onLeft || onRight;
  }, [selection, sheet, scrollLeft, scrollTop]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const colHandle = getColResizeHandle(e.clientX, e.clientY);
    if (colHandle !== null) {
      resizing.current = {
        type: "col", index: colHandle,
        startPx: e.clientX,
        startSize: getColWidth(sheet.config, colHandle),
      };
      return;
    }

    // Corner Select All
    if (x < ROW_HEADER_WIDTH && y < COL_HEADER_HEIGHT) {
      onSelectAll();
      return;
    }

    // Header Select Column
    if (y < COL_HEADER_HEIGHT && x > ROW_HEADER_WIDTH) {
      const colOffsets = buildOffsets(sheet.data[0]?.length ?? 0, c => getColWidth(sheet.config, c));
      const col = hitTest(colOffsets, x - ROW_HEADER_WIDTH + scrollLeft);
      onSelectFullColumn(col);
      return;
    }

    // Header Select Row
    if (x < ROW_HEADER_WIDTH && y > COL_HEADER_HEIGHT) {
      const rowOffsets = buildOffsets(sheet.data.length, r => getRowHeight(sheet.config, r));
      const row = hitTest(rowOffsets, y - COL_HEADER_HEIGHT + scrollTop);
      onSelectFullRow(row);
      return;
    }

    if (isOnSelectionBorder(e.clientX, e.clientY)) {
      dragging.current = true;
      return;
    }
    const cell = getCell(e.clientX, e.clientY);
    if (cell) onSelectCell(cell.row, cell.col, e.shiftKey);
  }, [getCell, getColResizeHandle, onSelectCell, onSelectFullColumn, onSelectFullRow, onSelectAll, sheet.config, sheet.data, scrollLeft, scrollTop, isOnSelectionBorder]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (resizing.current) {
      const delta = e.clientX - resizing.current.startPx;
      const newSize = Math.max(30, resizing.current.startSize + delta);
      if (resizing.current.type === "col") onResizeCol(resizing.current.index, newSize);
      return;
    }
    if (dragging.current) {
      const cell = getCell(e.clientX, e.clientY);
      if (cell) {
        setDragTarget(cell);
      }
      return;
    }
    // Cursor
    const colHandle = getColResizeHandle(e.clientX, e.clientY);
    const onBorder = isOnSelectionBorder(e.clientX, e.clientY);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = colHandle !== null ? "col-resize" : onBorder ? "move" : "cell";
    }
  }, [getColResizeHandle, onResizeCol, getCell, isOnSelectionBorder]);

  const onMouseUp = useCallback(() => {
    if (dragging.current && dragTarget && selection) {
      onMoveCells(selection, dragTarget.row, dragTarget.col);
    }
    resizing.current = null;
    dragging.current = false;
    setDragTarget(null);
  }, [dragTarget, selection, onMoveCells]);
  const onDblClick = useCallback((e: React.MouseEvent) => {
    const cell = getCell(e.clientX, e.clientY);
    if (cell) onStartEdit(cell.row, cell.col);
  }, [getCell, onStartEdit]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y <= COL_HEADER_HEIGHT && x > ROW_HEADER_WIDTH) {
      // Column Header
      const colOffsets = buildOffsets(sheet.data[0]?.length ?? 0, c => getColWidth(sheet.config, c));
      const col = hitTest(colOffsets, x - ROW_HEADER_WIDTH + scrollLeft);
      onHeaderContextMenu("col", col, e.clientX, e.clientY);
      e.preventDefault();
    } else if (x <= ROW_HEADER_WIDTH && y > COL_HEADER_HEIGHT) {
      // Row Header
      const rowOffsets = buildOffsets(sheet.data.length, r => getRowHeight(sheet.config, r));
      const row = hitTest(rowOffsets, y - COL_HEADER_HEIGHT + scrollTop);
      onHeaderContextMenu("row", row, e.clientX, e.clientY);
      e.preventDefault();
    } else {
      // Cell context menu
      const cell = getCell(e.clientX, e.clientY);
      if (cell) {
        onCellContextMenu(cell.row, cell.col, e.clientX, e.clientY);
        e.preventDefault();
      }
    }
  }, [sheet, scrollLeft, scrollTop, onHeaderContextMenu, onCellContextMenu, getCell]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDblClick}
        onContextMenu={onContextMenu}
        style={{ display: "block", cursor: "cell" }}
      />
    </div>
  );
});

export default SpreadsheetCanvas;
