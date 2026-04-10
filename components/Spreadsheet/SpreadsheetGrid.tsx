"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { ColDef, CellValue, SpreadsheetRow } from "./types";

interface Props {
  cols: ColDef[];
  rows: SpreadsheetRow[];
  evaluatedGrid: SpreadsheetRow[];
  onCellChange: (rowIdx: number, colKey: string, value: CellValue) => void;
  onResizeCol: (colKey: string, width: number) => void;
  imageCell: { rowIdx: number; colKey: string; src: string } | null;
}

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 32;
const ROW_NUM_WIDTH = 48;

// ── Cell editor ──────────────────────────────────────────────────────────────
const CellEditor = memo(function CellEditor({ value, onCommit, onCancel }: {
  value: string; onCommit: (v: string) => void; onCancel: () => void;
}) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(v);
        if (e.key === "Escape") onCancel();
      }}
      style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "#1e1a36", color: "white", fontSize: 12, padding: "0 6px", fontFamily: "inherit" }}
    />
  );
});

// ── Column resize handle ─────────────────────────────────────────────────────
const ResizeHandle = memo(function ResizeHandle({ colKey, onResize }: { colKey: string; onResize: (key: string, delta: number) => void }) {
  const startX = useRef(0);
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    const onMove = (ev: MouseEvent) => onResize(colKey, ev.clientX - startX.current);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <div onMouseDown={onMouseDown} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize", zIndex: 2 }} />
  );
});

// ── Single cell — memoized so only changed cells re-render ───────────────────
const GridCell = memo(function GridCell({ width, rawVal, displayVal, isEditing, isSelected, isImg, imgSrc, onSelect, onDoubleClick, onCommit, onCancel }: {
  width: number; rawVal: CellValue; displayVal: CellValue;
  isEditing: boolean; isSelected: boolean; isImg: boolean; imgSrc?: string;
  onSelect: () => void; onDoubleClick: () => void;
  onCommit: (v: string) => void; onCancel: () => void;
}) {
  const isNum = displayVal != null && typeof displayVal === "number";
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      style={{
        width, flexShrink: 0, height: ROW_HEIGHT,
        borderRight: "1px solid rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        background: isSelected ? "rgba(147,51,234,0.12)" : "transparent",
        outline: isSelected ? "1px solid rgba(147,51,234,0.5)" : "none",
        outlineOffset: -1, overflow: "hidden", position: "relative", cursor: "cell",
      }}
    >
      {isEditing ? (
        <CellEditor value={String(rawVal ?? "")} onCommit={onCommit} onCancel={onCancel} />
      ) : isImg && imgSrc ? (
        <img src={imgSrc} alt="" style={{ maxHeight: ROW_HEIGHT - 2, maxWidth: width - 4, objectFit: "contain", margin: "1px 2px" }} />
      ) : (
        <div style={{
          padding: "0 6px", lineHeight: `${ROW_HEIGHT}px`, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
          textAlign: isNum ? "right" : "left",
          fontSize: 12,
          color: displayVal == null ? "rgba(255,255,255,0.08)" : isNum ? "#a5f3fc" : "rgba(255,255,255,0.85)",
        }}>
          {displayVal == null ? "·" : String(displayVal)}
        </div>
      )}
    </div>
  );
});

// ── Row — memoized so unchanged rows don't re-render ────────────────────────
const GridRow = memo(function GridRow({ ri, row, evaluatedRow, cols, editing, selected, imageCell, onSelect, onDoubleClick, onCommit, onCancel }: {
  ri: number; row: SpreadsheetRow; evaluatedRow: SpreadsheetRow; cols: ColDef[];
  editing: { rowIdx: number; colKey: string } | null;
  selected: { rowIdx: number; colKey: string } | null;
  imageCell: { rowIdx: number; colKey: string; src: string } | null;
  onSelect: (ri: number, key: string) => void;
  onDoubleClick: (ri: number, key: string) => void;
  onCommit: (ri: number, key: string, v: string) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", height: ROW_HEIGHT, background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
      <div style={{ width: ROW_NUM_WIDTH, flexShrink: 0, borderRight: "1px solid rgba(147,51,234,0.12)", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, background: "rgba(147,51,234,0.03)" }}>
        <Text size="10px" c="rgba(255,255,255,0.2)">{ri + 1}</Text>
      </div>
      {cols.map((col) => (
        <GridCell
          key={col.key}
          width={col.width}
          rawVal={row[col.key]}
          displayVal={evaluatedRow[col.key]}
          isEditing={editing?.rowIdx === ri && editing?.colKey === col.key}
          isSelected={selected?.rowIdx === ri && selected?.colKey === col.key}
          isImg={imageCell?.rowIdx === ri && imageCell?.colKey === col.key}
          imgSrc={imageCell?.rowIdx === ri && imageCell?.colKey === col.key ? imageCell.src : undefined}
          onSelect={() => onSelect(ri, col.key)}
          onDoubleClick={() => onDoubleClick(ri, col.key)}
          onCommit={(v) => onCommit(ri, col.key, v)}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
});

// ── Main grid ────────────────────────────────────────────────────────────────
export function SpreadsheetGrid({ cols, rows, evaluatedGrid, onCellChange, onResizeCol, imageCell }: Props) {
  const [editing, setEditing] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [selected, setSelected] = useState<{ rowIdx: number; colKey: string } | null>(null);

  // Track resize start widths without triggering re-renders
  const resizeBase = useRef<Record<string, number>>({});

  const handleResizeStart = useCallback((colKey: string, delta: number) => {
    const base = resizeBase.current[colKey] ?? (cols.find(c => c.key === colKey)?.width ?? 120);
    const newW = Math.max(60, base + delta);
    resizeBase.current[colKey] = newW;
    onResizeCol(colKey, newW);
  }, [cols, onResizeCol]);

  const handleSelect = useCallback((ri: number, key: string) => setSelected({ rowIdx: ri, colKey: key }), []);
  const handleDoubleClick = useCallback((ri: number, key: string) => setEditing({ rowIdx: ri, colKey: key }), []);
  const handleCommit = useCallback((ri: number, key: string, v: string) => {
    onCellChange(ri, key, v === "" ? null : v);
    setEditing(null);
  }, [onCellChange]);
  const handleCancel = useCallback(() => setEditing(null), []);

  const totalWidth = ROW_NUM_WIDTH + cols.reduce((s, c) => s + c.width, 0);

  return (
    <div style={{ overflow: "auto", flex: 1, background: "#0a0814" }}>
      <div style={{ minWidth: totalWidth, userSelect: "none" }}>
        {/* Header */}
        <div style={{ display: "flex", height: HEADER_HEIGHT, position: "sticky", top: 0, zIndex: 10, background: "#0f0c1e" }}>
          <div style={{ width: ROW_NUM_WIDTH, flexShrink: 0, borderRight: "1px solid rgba(147,51,234,0.15)", borderBottom: "1px solid rgba(147,51,234,0.15)" }} />
          {cols.map((col) => (
            <div key={col.key} style={{ width: col.width, flexShrink: 0, position: "relative", borderRight: "1px solid rgba(147,51,234,0.12)", borderBottom: "1px solid rgba(147,51,234,0.15)", display: "flex", alignItems: "center", paddingLeft: 8, background: "rgba(147,51,234,0.06)" }}>
              <Text size="11px" fw={700} c="rgba(192,132,252,0.8)" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.name}</Text>
              <ResizeHandle colKey={col.key} onResize={handleResizeStart} />
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, ri) => (
          <GridRow
            key={ri}
            ri={ri}
            row={row}
            evaluatedRow={evaluatedGrid[ri] ?? row}
            cols={cols}
            editing={editing}
            selected={selected}
            imageCell={imageCell}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
            onCommit={handleCommit}
            onCancel={handleCancel}
          />
        ))}
      </div>
    </div>
  );
}
