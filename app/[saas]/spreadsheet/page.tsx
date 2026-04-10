"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Box, Group, ActionIcon, Tooltip, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as XLSX from "xlsx";
import { Sheet, Selection, Cell, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, DEFAULT_ROWS, DEFAULT_COLS } from "@/components/Spreadsheet/types";
import { makeEmptySheet, colIndexToLetter, buildOffsets, getColWidth, getRowHeight } from "@/components/Spreadsheet/utils";
import { evalFormula } from "@/components/Spreadsheet/formulaEngine";
import type { CanvasHandle } from "@/components/Spreadsheet/SpreadsheetCanvas";
import { FloatingImages } from "@/components/Spreadsheet/FloatingImages";
import { SpreadsheetToolbar } from "@/components/Spreadsheet/SpreadsheetToolbar";
import { QueryImportModal } from "@/components/Spreadsheet/QueryImportModal";

const SpreadsheetCanvas = dynamic(
  () => import("@/components/Spreadsheet/SpreadsheetCanvas"),
  { ssr: false }
);

function xlsxToSheet(wb: XLSX.WorkBook, sheetName: string): Sheet {
  const ws = wb.Sheets[sheetName];
  const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const rows = Math.max(json.length + 10, DEFAULT_ROWS);
  const cols = Math.max((json[0]?.length ?? 0) + 5, DEFAULT_COLS);
  const data: (Cell | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  json.forEach((row, r) => {
    row.forEach((val, c) => {
      if (val != null && val !== "") {
        data[r][c] = { v: typeof val === "number" ? val : String(val) };
      }
    });
  });
  return { id: crypto.randomUUID(), name: sheetName, data, config: { rowlen: {}, columnlen: {} } };
}

// ── Sheet tabs with right-click context menu ─────────────────────────────────
function SheetTabs({ sheets, activeIdx, onSelect, onAdd, onRename, onRemove }: {
  sheets: Sheet[];
  activeIdx: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onRename: (i: number, name: string) => void;
  onRemove: (i: number) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const openMenu = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, idx });
  };

  const closeMenu = () => setMenu(null);

  const startRename = (idx: number) => {
    setRenamingIdx(idx);
    setRenameValue(sheets[idx].name);
    closeMenu();
    setTimeout(() => document.getElementById(`sheet-rename-${idx}`)?.focus(), 0);
  };

  const commitRename = (idx: number) => {
    if (renameValue.trim()) onRename(idx, renameValue.trim());
    setRenamingIdx(null);
  };

  return (
    <>
      <Box style={{ background: "#0a0814", borderTop: "1px solid rgba(147,51,234,0.12)", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {sheets.map((s, i) => (
          <Box
            key={s.id}
            onClick={() => renamingIdx !== i && onSelect(i)}
            onContextMenu={(e) => openMenu(e, i)}
            onDoubleClick={() => startRename(i)}
            style={{
              padding: "3px 12px", borderRadius: "4px 4px 0 0", cursor: "pointer", fontSize: 12,
              background: i === activeIdx ? "rgba(147,51,234,0.2)" : "transparent",
              border: i === activeIdx ? "1px solid rgba(147,51,234,0.3)" : "1px solid transparent",
              color: i === activeIdx ? "white" : "rgba(255,255,255,0.5)",
              minWidth: 60, position: "relative",
            }}
          >
            {renamingIdx === i ? (
              <input
                id={`sheet-rename-${i}`}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => commitRename(i)}
                onKeyDown={e => {
                  if (e.key === "Enter") commitRename(i);
                  if (e.key === "Escape") setRenamingIdx(null);
                  e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: "#1e1a36", border: "1px solid #a855f7", borderRadius: 3,
                  color: "white", fontSize: 12, outline: "none", padding: "0 4px",
                  width: Math.max(60, renameValue.length * 8),
                }}
              />
            ) : s.name}
          </Box>
        ))}
        <Tooltip label="Add sheet" withArrow>
          <ActionIcon size="xs" variant="subtle" color="dimmed" onClick={onAdd}><IconPlus size={12} /></ActionIcon>
        </Tooltip>
      </Box>

      {/* Context menu */}
      {menu && (
        <>
          {/* Backdrop */}
          <div onClick={closeMenu} onContextMenu={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
          <Box
            style={{
              position: "fixed", left: menu.x, bottom: window.innerHeight - menu.y, zIndex: 1000,
              background: "#130f22", border: "1px solid rgba(147,51,234,0.25)",
              borderRadius: 8, padding: "4px", minWidth: 160,
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
            }}
          >
            <Box
              onClick={() => startRename(menu.idx)}
              style={{ padding: "7px 12px", borderRadius: 5, cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(147,51,234,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Rename
            </Box>
            <Box style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "3px 0" }} />
            <Box
              onClick={() => { onRemove(menu.idx); closeMenu(); }}
              style={{ padding: "7px 12px", borderRadius: 5, cursor: "pointer", fontSize: 13, color: sheets.length === 1 ? "rgba(255,255,255,0.25)" : "#f87171", display: "flex", alignItems: "center", gap: 8, pointerEvents: sheets.length === 1 ? "none" : "auto" }}
              onMouseEnter={e => { if (sheets.length > 1) e.currentTarget.style.background = "rgba(248,113,113,0.1)"; }}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              {sheets.length === 1 ? "Can't remove last sheet" : "Remove"}
            </Box>
          </Box>
        </>
      )}
    </>
  );
}

export default function SpreadsheetPage() {
  const [sheets, setSheets] = useState<Sheet[]>([makeEmptySheet()]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selection, setSelection] = useState<Selection | null>({ row: [0, 0], col: [0, 0], rowFocus: 0, colFocus: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filename, setFilename] = useState("Untitled");
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [queryModalOpen, setQueryModalOpen] = useState(false);

  const { saas } = useParams();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const canvasRef = useRef<CanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ref mirrors for edit state — always current, safe to read in callbacks
  const editingCellRef = useRef<{ row: number; col: number } | null>(null);
  const editValueRef = useRef("");

  const sheet = sheets[activeSheetIdx];

  const updateSheet = useCallback((updater: (s: Sheet) => Sheet) => {
    setSheets(prev => prev.map((s, i) => i === activeSheetIdx ? updater(s) : s));
  }, [activeSheetIdx]);

  const commitEdit = useCallback(() => {
    const cell = editingCellRef.current;
    const value = editValueRef.current;
    if (!cell) return;
    editingCellRef.current = null;
    editValueRef.current = "";
    setEditingCell(null);
    setEditValue("");
    updateSheet(s => {
      const newData = s.data.map(r => [...r]);
      const isFormula = value.startsWith("=");
      newData[cell.row][cell.col] = value === "" ? null : {
        ...(newData[cell.row][cell.col] ?? {}),
        v: isFormula ? undefined : (isNaN(Number(value)) ? value : Number(value)),
        f: isFormula ? value : undefined,
      };
      return { ...s, data: newData };
    });
  }, [updateSheet]);

  const cancelEdit = useCallback(() => {
    editingCellRef.current = null;
    editValueRef.current = "";
    setEditingCell(null);
    setEditValue("");
  }, []);

  // ── Selection ────────────────────────────────────────────────────────────
  const handleSelectCell = useCallback((row: number, col: number, extend = false) => {
    // Commit any in-progress edit before moving to another cell
    if (editingCellRef.current) commitEdit();
    setSelection(prev => {
      if (extend && prev) {
        return {
          row: [Math.min(prev.rowFocus, row), Math.max(prev.rowFocus, row)],
          col: [Math.min(prev.colFocus, col), Math.max(prev.colFocus, col)],
          rowFocus: prev.rowFocus, colFocus: prev.colFocus,
        };
      }
      return { row: [row, row], col: [col, col], rowFocus: row, colFocus: col };
    });
  }, [commitEdit]);

  // ── Editing ──────────────────────────────────────────────────────────────
  const handleStartEdit = useCallback((row: number, col: number) => {
    const cell = sheet.data[row]?.[col];
    const val = cell?.f ?? String(cell?.v ?? "");
    editingCellRef.current = { row, col };
    editValueRef.current = val;
    setEditValue(val);
    setEditingCell({ row, col });
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, [sheet]);

  // Ref so keyboard handler always has latest handleFormat without dep issues
  const handleFormatRef = useRef<(attr: keyof Cell, value: any) => void>(() => {});

  // ── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingCell) {
        if (e.key === "Enter") { commitEdit(); e.preventDefault(); }
        if (e.key === "Escape") { cancelEdit(); e.preventDefault(); }
        return;
      }
      if (!selection) return;
      const { rowFocus: r, colFocus: c } = selection;
      const rows = sheet.data.length;
      const cols = sheet.data[0]?.length ?? 0;

      if (e.key === "ArrowDown") { handleSelectCell(Math.min(r + 1, rows - 1), c); e.preventDefault(); }
      else if (e.key === "ArrowUp") { handleSelectCell(Math.max(r - 1, 0), c); e.preventDefault(); }
      else if (e.key === "ArrowRight") { handleSelectCell(r, Math.min(c + 1, cols - 1)); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { handleSelectCell(r, Math.max(c - 1, 0)); e.preventDefault(); }
      else if (e.key === "Enter" || e.key === "F2") { handleStartEdit(r, c); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        const cur = sheet.data[r]?.[c]?.bl ?? 0;
        handleFormatRef.current("bl", cur ? 0 : 1); e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        const cur = sheet.data[r]?.[c]?.it ?? 0;
        handleFormatRef.current("it", cur ? 0 : 1); e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        const cur = sheet.data[r]?.[c]?.un ?? 0;
        handleFormatRef.current("un", cur ? 0 : 1); e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        // Cut: copy cell value to clipboard then clear the selection
        const cellsToCut: string[][] = [];
        for (let row = selection.row[0]; row <= selection.row[1]; row++) {
          const rowVals: string[] = [];
          for (let col = selection.col[0]; col <= selection.col[1]; col++) {
            const cell = sheet.data[row]?.[col];
            rowVals.push(cell?.f ?? String(cell?.v ?? ""));
          }
          cellsToCut.push(rowVals);
        }
        navigator.clipboard.writeText(cellsToCut.map(row => row.join("\t")).join("\n")).catch(() => {});
        updateSheet(s => {
          const newData = s.data.map(row => [...row]);
          for (let row = selection.row[0]; row <= selection.row[1]; row++)
            for (let col = selection.col[0]; col <= selection.col[1]; col++)
              newData[row][col] = null;
          return { ...s, data: newData };
        });
        e.preventDefault();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        updateSheet(s => {
          const newData = s.data.map(row => [...row]);
          for (let row = selection.row[0]; row <= selection.row[1]; row++)
            for (let col = selection.col[0]; col <= selection.col[1]; col++)
              newData[row][col] = null;
          return { ...s, data: newData };
        });
        e.preventDefault();
      } else if (!e.ctrlKey && !e.metaKey && e.key.length === 1) {
        setEditValue(e.key);
        handleStartEdit(r, c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingCell, selection, sheet, handleSelectCell, handleStartEdit, commitEdit, cancelEdit, updateSheet]);

  // ── Scroll ───────────────────────────────────────────────────────────────
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Column/row resize ────────────────────────────────────────────────────
  const handleResizeCol = useCallback((col: number, width: number) => {
    updateSheet(s => ({ ...s, config: { ...s.config, columnlen: { ...s.config.columnlen, [col]: width } } }));
  }, [updateSheet]);

  const handleResizeRow = useCallback((row: number, height: number) => {
    updateSheet(s => ({ ...s, config: { ...s.config, rowlen: { ...s.config.rowlen, [row]: height } } }));
  }, [updateSheet]);

  // ── Import ───────────────────────────────────────────────────────────────
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(new Uint8Array(ev.target!.result as ArrayBuffer), { type: "array" });
      setSheets(wb.SheetNames.map(name => xlsxToSheet(wb, name)));
      setActiveSheetIdx(0);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, []);

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    sheets.forEach(s => {
      const aoa = s.data.map(row => row.map(cell => {
        if (!cell) return null;
        if (cell.f) return evalFormula(cell.f, s.data);
        return cell.v ?? null;
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), s.name);
    });
    XLSX.writeFile(wb, `${filename || "export"}.xlsx`);
  }, [sheets, filename]);

  // ── Insert image ─────────────────────────────────────────────────────────
  const handleInsertImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target!.result as string;
      // Get natural dimensions then place as a floating overlay (fortune-sheet approach)
      const img = new window.Image();
      img.onload = () => {
        const w = Math.min(img.naturalWidth * 0.5, 400);
        const h = Math.min(img.naturalHeight * 0.5, 300);
        // Position near the selected cell
        const col = selection?.colFocus ?? 0;
        const row = selection?.rowFocus ?? 0;
        const colOffsets = buildOffsets(sheet.data[0]?.length ?? 0, c => getColWidth(sheet.config, c));
        const rowOffsets = buildOffsets(sheet.data.length, r => getRowHeight(sheet.config, r));
        const left = ROW_HEADER_WIDTH + colOffsets[col] - scrollLeft + 4;
        const top = COL_HEADER_HEIGHT + rowOffsets[row] - scrollTop + 4;
        updateSheet(s => ({
          ...s,
          images: [...(s.images ?? []), {
            id: `img_${Date.now()}`,
            src, left, top, width: w, height: h,
          }],
        }));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [selection, sheet, scrollLeft, scrollTop, updateSheet]);

  // ── Add sheet ────────────────────────────────────────────────────────────
  const handleAddSheet = useCallback(() => {
    const newSheet = makeEmptySheet(`Sheet${sheets.length + 1}`);
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetIdx(sheets.length);
  }, [sheets.length]);

  // ── Query import ─────────────────────────────────────────────────────────
  const handleQueryImport = useCallback((rows: Cell[][]) => {
    if (!rows.length) return;
    const startRow = selection?.rowFocus ?? 0;
    const startCol = selection?.colFocus ?? 0;
    updateSheet(s => {
      const newData = s.data.map(r => [...r]);
      rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          const r = startRow + ri;
          const c = startCol + ci;
          if (r < newData.length && c < (newData[0]?.length ?? 0)) {
            newData[r][c] = cell;
          }
        });
      });
      return { ...s, data: newData };
    });
  }, [selection, updateSheet]);
  const handleFormat = useCallback((attr: keyof Cell, value: any) => {
    if (!selection) return;
    updateSheet(s => {
      const newData = s.data.map(r => [...r]);
      for (let row = selection.row[0]; row <= selection.row[1]; row++) {
        for (let col = selection.col[0]; col <= selection.col[1]; col++) {
          newData[row][col] = { ...(newData[row][col] ?? {}), [attr]: value };
        }
      }
      return { ...s, data: newData };
    });
  }, [selection, updateSheet]);

  // Keep ref in sync
  handleFormatRef.current = handleFormat;

  // Active cell for toolbar state
  const activeCell = selection ? sheet.data[selection.rowFocus]?.[selection.colFocus] : null;
  const formulaBarValue = editingCell
    ? editValue
    : (() => {
        if (!selection) return "";
        const cell = sheet.data[selection.rowFocus]?.[selection.colFocus];
        return cell?.f ?? String(cell?.v ?? "");
      })();

  const cellAddress = selection
    ? `${colIndexToLetter(selection.colFocus)}${selection.rowFocus + 1}`
    : "";

  // Virtual scroll dimensions
  const totalW = ROW_HEADER_WIDTH + buildOffsets(sheet.data[0]?.length ?? 0, c => getColWidth(sheet.config, c)).at(-1)!;
  const totalH = COL_HEADER_HEIGHT + buildOffsets(sheet.data.length, r => getRowHeight(sheet.config, r)).at(-1)!;

  // Editing cell overlay position
  const getEditOverlay = () => {
    if (!editingCell) return null;
    const { row, col } = editingCell;
    const colOffsets = buildOffsets(sheet.data[0]?.length ?? 0, c => getColWidth(sheet.config, c));
    const rowOffsets = buildOffsets(sheet.data.length, r => getRowHeight(sheet.config, r));
    return {
      left: ROW_HEADER_WIDTH + colOffsets[col] - scrollLeft,
      top: COL_HEADER_HEIGHT + rowOffsets[row] - scrollTop,
      width: getColWidth(sheet.config, col),
      height: getRowHeight(sheet.config, row),
    };
  };
  const editOverlay = getEditOverlay();

  return (
    <Box h="calc(100vh - 56px)" style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#07050f" }}>
      {/* Toolbar */}
      <SpreadsheetToolbar
        activeCell={activeCell}
        onFormat={handleFormat}
        onImport={handleImport}
        onExport={handleExport}
        onInsertImage={handleInsertImage}
        onAddSheet={handleAddSheet}
        onOpenQueryImport={() => setQueryModalOpen(true)}
        filename={filename}
      />

      {/* Formula bar */}
      <Box style={{ background: "#0a0814", borderBottom: "1px solid rgba(147,51,234,0.1)", padding: "3px 8px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Box style={{ width: 60, background: "rgba(147,51,234,0.08)", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 4, padding: "2px 8px", textAlign: "center" }}>
          <Text size="12px" fw={600} c="violet.4">{cellAddress}</Text>
        </Box>
        <Text size="12px" c="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }}>fx</Text>
        <input
          ref={editInputRef}
          value={formulaBarValue}
          onChange={e => { setEditValue(e.target.value); editValueRef.current = e.target.value; }}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
          onFocus={() => { if (!editingCell && selection) handleStartEdit(selection.rowFocus, selection.colFocus); }}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "var(--font-geist-mono, monospace)" }}
        />
      </Box>

      {/* Grid */}
      <Box style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{ width: "100%", height: "100%", overflow: "auto", position: "relative" }}
        >
          {/* Virtual scroll spacer */}
          <div style={{ width: totalW, height: totalH, position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />

          {/* Canvas */}
          <div style={{ position: "sticky", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}>
            <SpreadsheetCanvas
              ref={canvasRef}
              sheet={sheet}
              selection={selection}
              editingCell={editingCell}
              onSelectCell={handleSelectCell}
              onStartEdit={handleStartEdit}
              onResizeCol={handleResizeCol}
              onResizeRow={handleResizeRow}
              scrollLeft={scrollLeft}
              scrollTop={scrollTop}
            />

            {/* Inline cell editor overlay */}
            {editingCell && editOverlay && (
              <input
                ref={editInputRef}
                value={editValue}
                onChange={e => { setEditValue(e.target.value); editValueRef.current = e.target.value; }}
                onKeyDown={e => { if (e.key === "Enter") { commitEdit(); e.preventDefault(); } if (e.key === "Escape") { cancelEdit(); e.preventDefault(); } }}
                autoFocus
                style={{
                  position: "absolute",
                  left: editOverlay.left,
                  top: editOverlay.top,
                  width: editOverlay.width,
                  height: editOverlay.height,
                  background: "#1e1a36",
                  border: "2px solid #a855f7",
                  outline: "none",
                  color: "white",
                  fontSize: 12,
                  padding: "0 6px",
                  fontFamily: "inherit",
                  zIndex: 10,
                  boxSizing: "border-box",
                }}
              />
            )}

            {/* Floating images overlay */}
            <FloatingImages
              images={sheet.images ?? []}
              onUpdate={(id, patch) => updateSheet(s => ({
                ...s,
                images: (s.images ?? []).map(img => img.id === id ? { ...img, ...patch } : img),
              }))}
              onRemove={(id) => updateSheet(s => ({
                ...s,
                images: (s.images ?? []).filter(img => img.id !== id),
              }))}
            />
          </div>
        </div>
      </Box>

      {/* Sheet tabs */}
      <SheetTabs
        sheets={sheets}
        activeIdx={activeSheetIdx}
        onSelect={setActiveSheetIdx}
        onAdd={handleAddSheet}
        onRename={(i, name) => setSheets(prev => prev.map((s, idx) => idx === i ? { ...s, name } : s))}
        onRemove={(i) => {
          if (sheets.length === 1) return;
          setSheets(prev => prev.filter((_, idx) => idx !== i));
          setActiveSheetIdx(prev => Math.min(prev, sheets.length - 2));
        }}
      />

      <QueryImportModal
        opened={queryModalOpen}
        onClose={() => setQueryModalOpen(false)}
        organizationId={activeOrg?._id ?? ""}
        onImport={handleQueryImport}
      />
    </Box>
  );
}
