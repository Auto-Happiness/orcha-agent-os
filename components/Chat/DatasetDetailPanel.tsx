import React, { useCallback } from "react";
import { Box, Group, Stack, Text, ScrollArea, ActionIcon } from "@mantine/core";
import { IconDownload, IconX } from "@tabler/icons-react";

interface DatasetDetailPanelProps {
  activeDetailTable: {
    data: any[];
    title: string;
    sql?: string;
  } | null;
  onClose: () => void;
}

export function DatasetDetailPanel({ activeDetailTable, onClose }: DatasetDetailPanelProps) {
  const handleDownloadCSV = useCallback(() => {
    if (!activeDetailTable || !activeDetailTable.data || activeDetailTable.data.length === 0) return;
    const { data, title } = activeDetailTable;
    const columns = Object.keys(data[0]);
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.join(",");
    const rows = data.map(row => columns.map(c => escape(row[c])).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_full.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDetailTable]);

  if (!activeDetailTable) return null;

  return (
    <Box
      style={{
        flex: 70,
        minWidth: 320,
        borderLeft: "1px solid rgba(147, 51, 234, 0.15)",
        background: "#0c0814",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
        zIndex: 10,
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      
      {/* Header */}
      <Box style={{ background: "#130f22", borderBottom: "1px solid rgba(147, 51, 234, 0.12)", padding: "14px 20px" }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" fw={700} c="violet.4" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Dataset View</Text>
            <Text fw={700} size="sm" c="white" truncate>{activeDetailTable.title}</Text>
          </Stack>
          <Group gap={8}>
            <ActionIcon variant="subtle" color="violet" radius="md" size="md" onClick={handleDownloadCSV} title="Download CSV">
              <IconDownload size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" radius="md" size="md" onClick={onClose} title="Close Panel">
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Table Body */}
      <Box style={{ flex: 1, overflow: "auto" }} p="md">
        <Box style={{ overflowX: "auto", minWidth: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,8,20,0.8)", border: "1px solid rgba(147, 51, 234, 0.1)" }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "10px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", fontWeight: 500, borderBottom: "1px solid rgba(147,51,234,0.12)", background: "rgba(147,51,234,0.04)", userSelect: "none" }}>#</th>
                {activeDetailTable.data.length > 0 && Object.keys(activeDetailTable.data[0]).map((col) => (
                  <th key={col} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(192,132,252,0.75)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid rgba(147,51,234,0.12)", borderLeft: "1px solid rgba(255,255,255,0.03)", background: "rgba(147,51,234,0.04)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDetailTable.data.map((row, ri) => {
                const columns = Object.keys(row);
                return (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(147,51,234,0.06)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; }}
                  >
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", borderBottom: "1px solid rgba(255,255,255,0.03)", userSelect: "none" }}>{ri + 1}</td>
                    {columns.map((col, ci) => {
                      const val = row[col];
                      const isNull = val == null;
                      const isNumericString = typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim());
                      const isNum = !isNull && (typeof val === "number" || isNumericString);
                      
                      const lowerCol = col.toLowerCase();
                      const isIdentifier = lowerCol === "id" || lowerCol.endsWith("_id") || lowerCol.endsWith("id") || lowerCol === "year" || lowerCol === "zip" || lowerCol === "zipcode" || lowerCol.includes("phone");
                      
                      let displayVal = String(val);
                      if (!isNull && isNum && !isIdentifier) {
                        const numVal = Number(val);
                        if (!isNaN(numVal)) {
                          displayVal = numVal.toLocaleString();
                        }
                      } else if (isNull) {
                        displayVal = "null";
                      }

                      const numericValue = !isNull && isNum ? Number(val) : NaN;
                      const isNegative = !isNaN(numericValue) && numericValue < 0;

                      return (
                        <td key={ci} style={{ padding: "8px 16px", fontSize: 12, color: isNull ? "rgba(255,255,255,0.2)" : isNum && isNegative ? "#f87171" : isNum ? "#a5f3fc" : "rgba(255,255,255,0.82)", fontStyle: isNull ? "italic" : "normal", fontFamily: isNum ? "var(--font-geist-mono,monospace)" : "inherit", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.03)", textAlign: isNum ? "right" : "left" }}>
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    </Box>
  );
}
