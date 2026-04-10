"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Group, ActionIcon, Tooltip, Select, Box, Text, Divider } from "@mantine/core";
import {
  IconBold, IconItalic, IconUnderline, IconStrikethrough,
  IconAlignLeft, IconAlignCenter, IconAlignRight,
  IconLayoutAlignTop, IconLayoutAlignMiddle, IconLayoutAlignBottom,
  IconUpload, IconDownload, IconPhoto, IconPlus,
  IconPalette, IconDatabaseImport,
} from "@tabler/icons-react";
import { Cell } from "./types";

interface Props {
  // Current focused cell for showing active state
  activeCell?: Cell | null;
  onFormat: (attr: keyof Cell, value: any) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onInsertImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddSheet: () => void;
  onOpenQueryImport: () => void;
  filename: string;
}

const FONT_SIZES = ["8","9","10","11","12","14","16","18","20","22","24","28","32","36","48","60","72","75"];
const FONT_FAMILIES = [
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
];

const PRESET_COLORS = [
  "#ffffff","#000000","#ef4444","#f97316","#eab308","#22c55e",
  "#3b82f6","#8b5cf6","#ec4899","#6b7280",
  "#fca5a5","#fdba74","#fde047","#86efac","#93c5fd","#c4b5fd",
  "#f9a8d4","#d1d5db","#1e293b","#0f172a",
];

function ColorPicker({ value, onChange, label }: { value?: string; onChange: (c: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openPicker = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(o => !o);
  };

  return (
    <Box style={{ position: "relative" }}>
      <Tooltip label={label} withArrow>
        <ActionIcon
          ref={btnRef}
          variant="subtle"
          color="dimmed"
          size="sm"
          onClick={openPicker}
          style={{ position: "relative" }}
        >
          <IconPalette size={15} />
          <Box style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 12, height: 3, borderRadius: 1, background: value ?? "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }} />
        </ActionIcon>
      </Tooltip>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
          <Box style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "#130f22", border: "1px solid rgba(147,51,234,0.25)",
            borderRadius: 8, padding: 8, width: 160,
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3, marginBottom: 8 }}>
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => { onChange(c); setOpen(false); }}
                  style={{
                    width: 12, height: 12, borderRadius: 2, background: c, cursor: "pointer",
                    border: value === c ? "2px solid #a855f7" : "1px solid rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
            <Group gap={4}>
              <input
                type="color"
                value={value ?? "#ffffff"}
                onChange={e => onChange(e.target.value)}
                style={{ width: 24, height: 24, border: "none", background: "none", cursor: "pointer", padding: 0 }}
              />
              <Text size="11px" c="dimmed">Custom</Text>
            </Group>
          </Box>
        </>,
        document.body
      )}
    </Box>
  );
}

export function SpreadsheetToolbar({ activeCell, onFormat, onImport, onExport, onInsertImage, onAddSheet, onOpenQueryImport, filename }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const isActive = useCallback((attr: keyof Cell, val: any = 1) => {
    return activeCell?.[attr] === val;
  }, [activeCell]);

  const sep = <Box style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />;

  return (
    <Box style={{ background: "#0f0c1e", borderBottom: "1px solid rgba(147,51,234,0.15)", padding: "4px 12px", flexShrink: 0, overflowX: "auto" }}>
      <Group gap={4} wrap="nowrap" align="center">
        {/* File name */}
        <Text size="sm" fw={600} c="white" style={{ minWidth: 80, flexShrink: 0 }}>{filename}</Text>
        {sep}

        {/* Import / Export */}
        <Tooltip label="Import Excel / CSV" withArrow>
          <ActionIcon variant="subtle" color="violet" size="sm" onClick={() => fileRef.current?.click()}><IconUpload size={14} /></ActionIcon>
        </Tooltip>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onImport} />
        <Tooltip label="Export as Excel" withArrow>
          <ActionIcon variant="subtle" color="violet" size="sm" onClick={onExport}><IconDownload size={14} /></ActionIcon>
        </Tooltip>
        <Tooltip label="Import from saved query" withArrow>
          <ActionIcon variant="subtle" color="violet" size="sm" onClick={onOpenQueryImport}><IconDatabaseImport size={14} /></ActionIcon>
        </Tooltip>
        {sep}

        {/* Font family */}
        <Select
          data={FONT_FAMILIES}
          value={activeCell?.ff ? String(activeCell.ff) : "Arial"}
          onChange={v => v && onFormat("ff", v)}
          variant="unstyled"
          size="xs"
          w={120}
          styles={{
            input: { color: "rgba(255,255,255,0.8)", fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "0 8px", height: 26 },
            dropdown: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 6 },
            option: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
          }}
        />

        {/* Font size */}
        <Select
          data={FONT_SIZES.map(s => ({ value: s, label: s }))}
          value={activeCell?.fs ? String(activeCell.fs) : "12"}
          onChange={v => v && onFormat("fs", Number(v))}
          variant="unstyled"
          size="xs"
          w={60}
          styles={{
            input: { color: "rgba(255,255,255,0.8)", fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "0 8px", height: 26 },
            dropdown: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 6 },
            option: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
          }}
        />
        {sep}

        {/* Bold / Italic / Underline / Strikethrough */}
        <Tooltip label="Bold (Ctrl+B)" withArrow>
          <ActionIcon variant={isActive("bl") ? "filled" : "subtle"} color={isActive("bl") ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("bl", isActive("bl") ? 0 : 1)}>
            <IconBold size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Italic (Ctrl+I)" withArrow>
          <ActionIcon variant={isActive("it") ? "filled" : "subtle"} color={isActive("it") ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("it", isActive("it") ? 0 : 1)}>
            <IconItalic size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Underline (Ctrl+U)" withArrow>
          <ActionIcon variant={isActive("un") ? "filled" : "subtle"} color={isActive("un") ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("un", isActive("un") ? 0 : 1)}>
            <IconUnderline size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Strikethrough" withArrow>
          <ActionIcon variant={isActive("cl") ? "filled" : "subtle"} color={isActive("cl") ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("cl", isActive("cl") ? 0 : 1)}>
            <IconStrikethrough size={14} />
          </ActionIcon>
        </Tooltip>
        {sep}

        {/* Font color / Background color */}
        <ColorPicker value={activeCell?.fc} onChange={c => onFormat("fc", c)} label="Font color" />
        <ColorPicker value={activeCell?.bg} onChange={c => onFormat("bg", c)} label="Cell background" />
        {sep}

        {/* Horizontal align */}
        <Tooltip label="Align left" withArrow>
          <ActionIcon variant={isActive("ht", 1) ? "filled" : "subtle"} color={isActive("ht", 1) ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("ht", 1)}>
            <IconAlignLeft size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Align center" withArrow>
          <ActionIcon variant={isActive("ht", 2) ? "filled" : "subtle"} color={isActive("ht", 2) ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("ht", 2)}>
            <IconAlignCenter size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Align right" withArrow>
          <ActionIcon variant={isActive("ht", 3) ? "filled" : "subtle"} color={isActive("ht", 3) ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("ht", 3)}>
            <IconAlignRight size={14} />
          </ActionIcon>
        </Tooltip>
        {sep}

        {/* Vertical align */}
        <Tooltip label="Align top" withArrow>
          <ActionIcon variant={isActive("vt", 1) ? "filled" : "subtle"} color={isActive("vt", 1) ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("vt", 1)}>
            <IconLayoutAlignTop size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Align middle" withArrow>
          <ActionIcon variant={isActive("vt", 2) ? "filled" : "subtle"} color={isActive("vt", 2) ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("vt", 2)}>
            <IconLayoutAlignMiddle size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Align bottom" withArrow>
          <ActionIcon variant={isActive("vt", 3) ? "filled" : "subtle"} color={isActive("vt", 3) ? "violet" : "dimmed"} size="sm" onClick={() => onFormat("vt", 3)}>
            <IconLayoutAlignBottom size={14} />
          </ActionIcon>
        </Tooltip>
        {sep}

        {/* Insert image */}
        <Tooltip label="Insert image" withArrow>
          <ActionIcon variant="subtle" color="dimmed" size="sm" onClick={() => imgRef.current?.click()}><IconPhoto size={14} /></ActionIcon>
        </Tooltip>
        <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onInsertImage} />
      </Group>
    </Box>
  );
}
