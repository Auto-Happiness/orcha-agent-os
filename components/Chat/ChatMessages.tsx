"use client";

import { Stack, Group, Avatar, Text, Box, Button, ScrollArea, Loader, Modal, Popover, ColorPicker, ActionIcon, ColorInput, Divider, Tooltip as MantineTooltip, UnstyledButton, Collapse } from "@mantine/core";
import { IconUser, IconSparkles, IconTableExport, IconDatabase, IconCode, IconDownload, IconBookmark, IconCheck, IconChartBar, IconPalette, IconBrain, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { UIMessage } from "ai";
import React, { useCallback, useState, memo, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useDisclosure } from "@mantine/hooks";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  showResults: boolean;
  organizationId?: string;
  configId?: string | null;
}

// ── DataTable ────────────────────────────────────────────────────────────────

const DataTable = memo(function DataTable({ data, sql, organizationId, configId }: {
  data: any[];
  sql?: string;
  organizationId?: string;
  configId?: string | null;
}) {
  const columns = Object.keys(data[0]);
  const hasMore = data.length >= 50;

  const exportPreviewCsv = useCallback(() => {
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
    a.download = "preview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data, columns]);

  // Full export via API — fetch with streaming, no full blob buffering
  const exportFullCsv = useCallback(async () => {
    if (!sql || !organizationId) return;
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, organizationId, configId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  }, [sql, organizationId, configId]);

  return (
    <Box style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(147,51,234,0.18)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(147,51,234,0.06)" }}>
      {/* Toolbar */}
      <Box style={{ background: "rgba(19,16,42,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(147,51,234,0.12)", padding: "10px 16px" }}>
        <Group justify="space-between">
          <Group gap={10}>
            <Group gap={5}>
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(147,51,234,0.6)", boxShadow: "0 0 8px rgba(147,51,234,0.8)" }} />
            </Group>
            <Box style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
            <Text size="11px" fw={600} c="rgba(192,132,252,0.8)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>Result Set</Text>
            <Box style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(147,51,234,0.12)", border: "1px solid rgba(147,51,234,0.2)" }}>
              <Text size="10px" fw={700} c="violet.4">{data.length.toLocaleString()} rows · {columns.length} cols</Text>
            </Box>
          </Group>
          <Button variant="subtle" size="compact-xs" color="violet" radius="md" leftSection={<IconTableExport size={11} />} onClick={exportPreviewCsv} styles={{ root: { fontSize: 11, opacity: 0.7 } }}>
            Export preview
          </Button>
        </Group>
      </Box>

      {/* Table */}
      <ScrollArea>
        <Box style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,8,20,0.8)" }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "9px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", fontWeight: 500, borderBottom: "1px solid rgba(147,51,234,0.12)", background: "rgba(147,51,234,0.04)", userSelect: "none" }}>#</th>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(192,132,252,0.75)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid rgba(147,51,234,0.12)", borderLeft: "1px solid rgba(255,255,255,0.03)", background: "rgba(147,51,234,0.04)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(147,51,234,0.06)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; }}
                >
                  <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", borderBottom: "1px solid rgba(255,255,255,0.03)", userSelect: "none" }}>{ri + 1}</td>
                  {columns.map((col, ci) => {
                    const val = row[col];
                    const isNull = val == null;
                    const isNum = !isNull && typeof val === "number";
                    return (
                      <td key={ci} style={{ padding: "7px 16px", fontSize: 12, color: isNull ? "rgba(255,255,255,0.2)" : isNum && val < 0 ? "#f87171" : isNum ? "#a5f3fc" : "rgba(255,255,255,0.82)", fontStyle: isNull ? "italic" : "normal", fontFamily: isNum ? "var(--font-geist-mono,monospace)" : "inherit", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.03)", textAlign: isNum ? "right" : "left" }}>
                        {isNull ? "null" : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </ScrollArea>

      {/* Footer */}
      {hasMore && (
        <Box style={{ padding: "8px 16px", borderTop: "1px solid rgba(147,51,234,0.1)", background: "rgba(19,16,42,0.6)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Group gap={6}>
            <Box style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(147,51,234,0.5)" }} />
            <Text size="11px" c="dimmed">Showing {data.length} rows (limit reached — download for full dataset)</Text>
          </Group>
          {sql && (
            <Button size="compact-xs" variant="light" color="violet" radius="md" leftSection={<IconDownload size={11} />} onClick={exportFullCsv} styles={{ root: { fontSize: 11 } }}>
              Download full dataset
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
});

// ── ChartBlock ────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#a855f7", "#7c3aed", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#f97316", "#6366f1"];

const PALETTES = {
  Orcha: ["#a855f7", "#7c3aed", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#f97316", "#6366f1"],
  Ocean: ["#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#00d1ff", "#7dd3fc", "#e0f2fe"],
  Sunset: ["#f43f5e", "#e11d48", "#be123c", "#9f1239", "#fb7185", "#fda4af", "#fecdd3", "#fff1f2"],
  Forest: ["#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#34d399", "#6ee7b7", "#a7f3d0"],
  Cyberpunk: ["#ff00ff", "#00ffff", "#ffff00", "#ff00aa", "#aa00ff", "#00ffaa", "#ffaa00", "#00aaff"],
};

const chartTooltipStyle = {
  contentStyle: {
    background: "rgba(13,10,26,0.97)",
    border: "1px solid rgba(147,51,234,0.25)",
    borderRadius: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  labelStyle: { color: "rgba(192,132,252,0.9)", fontWeight: 600 },
  cursor: { fill: "rgba(147,51,234,0.07)" },
};

const axisStyle = {
  tick: { fill: "rgba(255,255,255,0.35)", fontSize: 11 },
  tickLine: false as const,
  axisLine: { stroke: "rgba(255,255,255,0.08)" },
};

const ChartBlock = memo(function ChartBlock({
  chartType, title, xKey, yKeys, data, initialColors, messageId, parts, partIndex
}: {
  chartType: "bar" | "line" | "area" | "pie";
  title: string;
  xKey: string;
  yKeys: string[];
  data: any[];
  initialColors?: Record<string, string>;
  messageId?: string;
  parts?: any[];
  partIndex?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(initialColors || {});
  const [popoverOpened, setPopoverOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const updateMessage = useMutation(api.chatMessages.update);

  // Identify all "elements" that can be colored
  const elements = (chartType === "pie" || (chartType === "bar" && yKeys.length === 1))
    ? data.map(row => String(row[xKey] ?? "Unknown"))
    : yKeys;

  // Initialize colors if missing
  useEffect(() => {
    if (initialColors && Object.keys(initialColors).length > 0) return;
    const newColors = { ...seriesColors };
    let changed = false;
    elements.forEach((el, i) => {
      if (!newColors[el]) {
        newColors[el] = CHART_COLORS[i % CHART_COLORS.length];
        changed = true;
      }
    });
    if (changed) setSeriesColors(newColors);
  }, [elements, initialColors]);

  const handleSave = async () => {
    if (!messageId || !parts || partIndex === undefined) return;
    setIsSaving(true);
    try {
      const newParts = [...parts];
      const part = { ...newParts[partIndex] };
      
      // Navigate to the chartConfig and inject the colors
      if (part.output) {
        part.output = { 
          ...part.output, 
          chartConfig: { ...part.output.chartConfig, seriesColors } 
        };
      } else if (part.toolInvocation?.result) {
        part.toolInvocation.result = {
          ...part.toolInvocation.result,
          chartConfig: { ...part.toolInvocation.result.chartConfig, seriesColors }
        };
      } else if (part.result) {
        part.result = {
          ...part.result,
          chartConfig: { ...part.result.chartConfig, seriesColors }
        };
      }

      newParts[partIndex] = part;
      await updateMessage({ messageId: messageId as any, parts: newParts });
      setPopoverOpened(false);
    } catch (e) {
      console.error("[ChartBlock] Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportJPG = () => {
    if (!chartRef.current) return;
    try {
      const svg = chartRef.current.querySelector("svg");
      if (!svg) return;

      // getBoundingClientRect gives real rendered pixel dimensions
      // unlike clientWidth which returns 0 for % width SVGs
      const rect = svg.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (!w || !h) {
        console.error("[ChartBlock] Could not determine chart dimensions");
        return;
      }

      // Clone the SVG and stamp in explicit pixel dimensions
      const svgClone = svg.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute("width", w.toString());
      svgClone.setAttribute("height", h.toString());
      svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const svgData = new XMLSerializer().serializeToString(svgClone);
      // Encode as a data URL so it loads in the image element without CORS issues
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

      const scale = 2; // 2x high-res
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;

      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#0a0814";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `${title.toLowerCase().replace(/\s+/g, "_")}_chart.jpg`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, "image/jpeg", 0.95);
      };
      img.onerror = (e) => console.error("[ChartBlock] Image load failed:", e);
      img.src = svgDataUrl;
    } catch (e) {
      console.error("[ChartBlock] Export failed:", e);
    }
  };

  if (!data || data.length === 0) return null;

  const renderChart = () => {
    if (chartType === "pie") {
      const valueKey = yKeys[0];
      const pieData = data.map((row) => ({ name: String(row[xKey] ?? ""), value: Number(row[valueKey] ?? 0) }));
      return (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} labelLine={false}>
            {pieData.map((entry, i) => <Cell key={i} fill={seriesColors[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip {...chartTooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
        </PieChart>
      );
    }
    if (chartType === "line") {
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={xKey} {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip {...chartTooltipStyle} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />}
          {yKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={seriesColors[k] || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />)}
        </LineChart>
      );
    }
    if (chartType === "area") {
      return (
        <AreaChart data={data}>
          <defs>
            {yKeys.map((k, i) => {
              const color = seriesColors[k] || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={xKey} {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip {...chartTooltipStyle} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />}
          {yKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={seriesColors[k] || CHART_COLORS[i % CHART_COLORS.length]} fill={`url(#grad-${k})`} strokeWidth={2} />
          ))}
        </AreaChart>
      );
    }
    // default: bar
    return (
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey={xKey} {...axisStyle} />
        <YAxis {...axisStyle} />
        <Tooltip {...chartTooltipStyle} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />}
        {yKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={seriesColors[k] || CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]}>
            {(yKeys.length === 1) && data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={seriesColors[String(entry[xKey])] || CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        ))}
      </BarChart>
    );
  };

  return (
    <Box style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(147,51,234,0.18)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(147,51,234,0.06)" }}>
      {/* Header */}
      <Box style={{ background: "rgba(19,16,42,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(147,51,234,0.12)", padding: "10px 16px" }}>
        <Group justify="space-between">
          <Group gap={10}>
            <Group gap={5}>
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(147,51,234,0.6)", boxShadow: "0 0 8px rgba(147,51,234,0.8)" }} />
            </Group>
            <Box style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
            <IconChartBar size={13} color="rgba(192,132,252,0.8)" />
            <Text size="11px" fw={600} c="rgba(192,132,252,0.8)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>{title}</Text>
            <Box style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(147,51,234,0.12)", border: "1px solid rgba(147,51,234,0.2)" }}>
              <Text size="10px" fw={700} c="violet.4">{chartType.toUpperCase()} · {data.length} rows</Text>
            </Box>
          </Group>
          <Group gap={5}>
            <Popover opened={popoverOpened} onChange={setPopoverOpened} position="bottom-end" shadow="md" withArrow closeOnClickOutside={false}>
              <Popover.Target>
                <ActionIcon variant="subtle" color="violet" radius="md" onClick={() => setPopoverOpened((o) => !o)} style={{ opacity: 0.7 }}>
                  <IconPalette size={14} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown style={{ background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)", minWidth: 260 }}>
                <Stack gap="md">
                  <Box>
                    <Text size="xs" fw={700} c="rgba(192,132,252,0.8)" mb="xs" style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>Quick Palettes</Text>
                    <Group gap={8}>
                      {Object.entries(PALETTES).map(([name, colors]) => (
                        <MantineTooltip key={name} label={name} position="top">
                          <Box 
                            onClick={() => {
                              const newColors = { ...seriesColors };
                              elements.forEach((el, i) => {
                                newColors[el] = colors[i % colors.length];
                              });
                              setSeriesColors(newColors);
                            }}
                            style={{ 
                              width: 24, 
                              height: 24, 
                              borderRadius: 4, 
                              cursor: "pointer", 
                              background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`,
                              border: "1px solid rgba(255,255,255,0.1)"
                            }} 
                          />
                        </MantineTooltip>
                      ))}
                    </Group>
                  </Box>

                  <Divider color="rgba(147,51,234,0.1)" />

                  <Box>
                    <Text size="xs" fw={700} c="rgba(192,132,252,0.8)" mb="xs" style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>Custom Elements</Text>
                    <ScrollArea.Autosize mah={300} type="auto">
                      <Stack gap={8}>
                        {elements.map((el) => (
                          <Group key={el} justify="space-between" wrap="nowrap">
                            <Text size="xs" c="dimmed" style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{el}</Text>
                            <ColorInput 
                              size="xs" 
                              w={100} 
                              value={seriesColors[el] || "#a855f7"} 
                              onChange={(c) => setSeriesColors(prev => ({ ...prev, [el]: c }))}
                              format="hex"
                              withPicker={true}
                              swatches={CHART_COLORS}
                              popoverProps={{ withinPortal: true, zIndex: 1000 }}
                            />
                          </Group>
                        ))}
                      </Stack>
                    </ScrollArea.Autosize>
                  </Box>

                  {messageId && (
                    <Button 
                      size="xs" 
                      color="violet" 
                      fullWidth 
                      variant="light" 
                      leftSection={<IconCheck size={14} />}
                      loading={isSaving}
                      onClick={handleSave}
                    >
                      Save Configuration
                    </Button>
                  )}
                </Stack>
              </Popover.Dropdown>
            </Popover>
            <ActionIcon variant="subtle" color="dimmed" radius="md" onClick={handleExportJPG} title="Export as JPG">
              <IconDownload size={14} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>
      {/* Chart */}
      <Box ref={chartRef} style={{ background: "rgba(10,8,20,0.85)", padding: "24px 12px 12px 4px" }}>
        <ResponsiveContainer width="100%" height={280}>
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Match bold (**text**), italic (*text*), code (`text`), and links [text](url)
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the matched element
    if (match[1]) {
      // Bold
      parts.push(
        <Text key={`bold-${match.index}`} component="span" fw={700} c="inherit">
          {match[1]}
        </Text>
      );
    } else if (match[2]) {
      // Italic
      parts.push(
        <Text key={`italic-${match.index}`} component="span" style={{ fontStyle: "italic" }} c="inherit">
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Code
      parts.push(
        <Text
          key={`code-${match.index}`}
          component="span"
          size="xs"
          style={{
            background: "rgba(147,51,234,0.15)",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "monospace",
          }}
          c="violet.2"
        >
          {match[3]}
        </Text>
      );
    } else if (match[4] && match[5]) {
      // Link
      parts.push(
        <Text
          key={`link-${match.index}`}
          component="a"
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          c="violet.3"
          style={{ textDecoration: "underline", cursor: "pointer" }}
        >
          {match[4]}
        </Text>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function extractSQLFromParts(parts: any[]): string[] {
  const queries: string[] = [];
  for (const part of parts) {
    const type: string = part.type ?? "";
    let sql: string | undefined;
    if (type === "tool-execute_sql") sql = part.input?.sql;
    else if (type === "tool-invocation" && part.toolInvocation?.toolName === "execute_sql")
      sql = (part.toolInvocation.input as any)?.sql ?? (part.toolInvocation.args as any)?.sql;
    else if (type === "tool-result" && part.toolName === "execute_sql")
      sql = (part.input as any)?.sql ?? (part.args as any)?.sql;
    
    if (sql && !queries.includes(sql)) queries.push(sql);
  }
  return queries;
}

function renderToolPart(part: any, i: number, showResults: boolean, organizationId?: string, configId?: string | null, messageId?: string, parts?: any[]) {
  const type: string = part.type ?? "";

  if (
    type === "tool-call" ||
    (type === "tool-invocation" && (part.toolInvocation?.state === "call" || part.toolInvocation?.state === "partial-call")) ||
    type.startsWith("tool-input") ||
    (type === "tool-execute_sql" && part.state === "input-streaming")
  ) {
    const toolName = part.toolInvocation?.toolName || part.toolName || "query";
    const isSQL = toolName === "execute_sql";
    
    return (
      <Box key={i} ml="3rem" mt="xs">
        <Group gap={6}>
          {isSQL ? <IconDatabase size={13} color="#a855f7" /> : <IconSparkles size={13} color="#a855f7" />}
          <Loader size="xs" color="violet" type="dots" />
          <Text size="xs" c="dimmed">{isSQL ? "Running query..." : `Performing ${toolName.replace(/_/g, ' ')}...`}</Text>
        </Group>
      </Box>
    );
  }

  let result: any = null;
  let toolName = "";

  if (type === "tool-execute_sql" && part.state === "output-available") {
    result = part.output;
    toolName = "execute_sql";
  }
  else if (type === "tool-result") {
    result = part.result;
    toolName = part.toolName;
  }
  else if (type === "tool-invocation" && part.toolInvocation?.state === "result") {
    result = part.toolInvocation.result;
    toolName = part.toolInvocation.toolName;
  }
  else if (type === "tool-output-available") {
    result = part.output;
    toolName = part.toolName || "tool";
  }

  if (!result) return null;

  if (result.success === false || result.error) {
    return <Box key={i} ml="3rem" mt="xs"><Text size="xs" c="red.4">Error: {result.error || result.message || "Action failed"}</Text></Box>;
  }

  const isSQL = toolName === "execute_sql";
  const partSql = isSQL 
    ? (part.input?.sql ?? part.toolInvocation?.args?.sql ?? part.args?.sql) 
    : undefined;

  // Render chart
  const isChart = isSQL && result.chartConfig != null;
  if (isChart && result.success && result.data?.length > 0) {
    const config = result.chartConfig;
    return (
      <Box key={i} ml="3rem" mt="sm">
        <ChartBlock
          chartType={config.chartType}
          title={config.title}
          xKey={config.xKey}
          yKeys={[config.yKey]}
          data={result.data}
          initialColors={config.seriesColors}
          messageId={messageId}
          parts={parts}
          partIndex={i}
        />
      </Box>
    );
  }

  // Render SQL Tables
  if (isSQL && result.data?.length > 0) {
    if (!showResults) return null;
    return (
      <Box key={i} ml="3rem" mt="sm">
        <DataTable data={result.data} sql={partSql} organizationId={organizationId} configId={configId} />
      </Box>
    );
  }

  if (isSQL && result.data?.length === 0) {
    return <Box key={i} ml="3rem" mt="xs"><Text size="xs" c="dimmed">Query returned no rows.</Text></Box>;
  }

  // Render Generic Tool Results (MCP)
  return (
    <Box key={i} ml="3rem" mt="xs">
      <Group gap={6}>
        <IconCheck size={12} color="var(--mantine-color-green-4)" />
        <Text size="xs" fw={600} c="green.3">
          Completed {toolName.replace(/_/g, ' ')}
        </Text>
      </Group>
      {result.content && typeof result.content === 'string' && (
        <Box mt={4} p="6px 12px" style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid rgba(147,51,234,0.1)" }}>
          <Text size="xs" c="dimmed">{result.content}</Text>
        </Box>
      )}
    </Box>
  );
}

// ── SQLModal ─────────────────────────────────────────────────────────────────

function SQLModal({ queries, opened, onClose, organizationId, configId }: {
  queries: string[]; opened: boolean; onClose: () => void;
  organizationId?: string; configId?: string | null;
}) {
  const saveQuery = useMutation(api.savedQueries.save);
  const currentUser = useQuery(api.users.getCurrentUser);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const handleSave = async (sql: string, idx: number) => {
    if (!organizationId || !configId || !currentUser?._id) return;
    setSaving(idx);
    try {
      await saveQuery({
        organizationId: organizationId as any,
        configId: configId as any,
        name: `Query ${new Date().toLocaleString()}`,
        sql,
        createdBy: currentUser._id,
      });
      setSaved(prev => new Set(prev).add(idx));
    } catch (e: any) {
      console.error("[SQLModal] Save failed:", e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose}
      title={<Group gap={8}><IconCode size={16} color="#a855f7" /><Text size="sm" fw={600} c="white">SQL Queries</Text></Group>}
      size="lg" radius="md"
      styles={{ content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" }, header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" }, title: { color: "white" } }}
    >
      <Stack gap="md" pt="xs">
        {queries.map((sql, i) => (
          <Box key={i}>
            {queries.length > 1 && <Text size="10px" fw={700} c="violet.4" mb={6} style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Query {i + 1}</Text>}
            <Box style={{ borderRadius: 8, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(147,51,234,0.15)", overflow: "hidden" }}>
              <Box style={{ padding: "10px 14px", fontFamily: "var(--font-geist-mono,monospace)", fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{sql}</Box>
              <Box style={{ borderTop: "1px solid rgba(147,51,234,0.1)", padding: "6px 10px", display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <Button size="compact-xs" variant="subtle" color="dimmed" onClick={() => navigator.clipboard.writeText(sql)}>Copy</Button>
                {organizationId && configId && (
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color={saved.has(i) ? "green" : "violet"}
                    loading={saving === i}
                    disabled={saved.has(i)}
                    leftSection={saved.has(i) ? <IconCheck size={11} /> : <IconBookmark size={11} />}
                    onClick={() => handleSave(sql, i)}
                  >
                    {saved.has(i) ? "Saved" : "Save Query"}
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Stack>
    </Modal>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  const [opened, { toggle }] = useDisclosure(true);
  // Bug fix: use a loose split instead of a strict regex so minor LLM formatting
  // variations (extra spaces, missing newline) don't break the strip.
  const reasoningMarker = "### \uD83E\uDDE0 Reasoning";
  const markerIndex = text.indexOf(reasoningMarker);
  const content = markerIndex >= 0
    ? text.slice(markerIndex + reasoningMarker.length).trimStart()
    : text;

  return (
    <Box 
      style={{ 
        background: "transparent", 
        border: "none",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 16
      }}
    >
      <UnstyledButton 
        onClick={toggle}
        p="xs"
        px="sm"
        w="100%"
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 10,
          background: "transparent"
        }}
      >
        <IconBrain size={15} color="#a855f7" />
        <Text fw={600} c="violet.2" style={{ flex: 1, fontSize: 10.5, letterSpacing: "0.01em" }}>Reasoning Process</Text>
        {opened ? <IconChevronUp size={14} opacity={0.5} /> : <IconChevronDown size={14} opacity={0.5} />}
      </UnstyledButton>
      
      <Collapse expanded={opened}>
        <Box p="xs" px="sm" pb="sm">
          <Text size="xs" c="rgba(255, 255, 255, 0.65)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {parseMarkdown(content)}
          </Text>
        </Box>
      </Collapse>
    </Box>
  );
}

// ── MessageRow (memoized — only re-renders when its own message changes) ─────

const MessageRow = memo(function MessageRow({ m, showResults, organizationId, configId, onViewSql }: {
  m: any; showResults: boolean; organizationId?: string; configId?: string | null; onViewSql: (q: string[]) => void;
}) {
  const sqlQueries = m.role === "assistant" ? extractSQLFromParts(m.parts as any[]) : [];
  return (
    <Stack gap="sm">
      <Group gap="md" align="flex-start" wrap="nowrap">
        <Avatar size="md" radius="xl" color={m.role === "user" ? "blue" : "violet"} style={{ background: m.role === "user" ? "rgba(37,99,235,0.1)" : "transparent", flexShrink: 0 }}>
          {m.role === "user" ? <IconUser size={20} /> : <IconSparkles size={24} style={{ color: "#a855f7" }} />}
        </Avatar>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" c="white">{m.role === "user" ? "You" : "Orcha Agent"}</Text>
          {m.parts.map((part: any, i: number) => {
            if (part.type !== "text" || !part.text) return null;

            const MARKER = "### \uD83E\uDDE0 Reasoning";
            const markerIdx = part.text.indexOf(MARKER);

            // Pure reasoning block (starts with marker, no prior text)
            if (markerIdx === 0) {
              return <ReasoningBlock key={i} text={part.text} />;
            }

            // Mixed: text before marker + reasoning block
            // This handles the case where the LLM emits reasoning + answer as one part
            if (markerIdx > 0) {
              const before = part.text.slice(0, markerIdx).trim();
              const reasoningAndAfter = part.text.slice(markerIdx);
              // Check if there is text AFTER the reasoning block
              const afterMarker = reasoningAndAfter.slice(MARKER.length).trimStart();
              const nextMarkerIdx = afterMarker.indexOf("\n\n");
              const reasoningContent = nextMarkerIdx > -1 ? afterMarker.slice(0, nextMarkerIdx) : afterMarker;
              const afterAnswer = nextMarkerIdx > -1 ? afterMarker.slice(nextMarkerIdx).trim() : "";
              return (
                <React.Fragment key={i}>
                  {before ? <Text size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{parseMarkdown(before)}</Text> : null}
                  <ReasoningBlock text={MARKER + "\n" + reasoningContent} />
                  {afterAnswer ? <Text size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{parseMarkdown(afterAnswer)}</Text> : null}
                </React.Fragment>
              );
            }

            // Plain text part — no reasoning marker
            return (
              <Text key={i} size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {parseMarkdown(part.text)}
              </Text>
            );
          })}
          {sqlQueries.length > 0 && (
            <Box mt={6}>
              <Button size="compact-xs" variant="subtle" color="violet" radius="md" leftSection={<IconCode size={11} />} onClick={() => onViewSql(sqlQueries)} styles={{ root: { fontSize: 11, opacity: 0.6 } }}>
                View SQL
              </Button>
            </Box>
          )}
        </Stack>
      </Group>
      {(m.parts as any[]).map((part: any, i: number) => renderToolPart(part, i, showResults, organizationId, configId, m.id || m._id, m.parts))}
    </Stack>
  );
});

// ── ChatMessages ─────────────────────────────────────────────────────────────

export function ChatMessages({ messages, isLoading, showResults, organizationId, configId }: ChatMessagesProps) {
  const [sqlModal, setSqlModal] = useState<string[] | null>(null);

  return (
    <>
      {messages.map((m) => (
        <MessageRow key={m.id} m={m} showResults={showResults} organizationId={organizationId} configId={configId} onViewSql={setSqlModal} />
      ))}

      {isLoading && (
        <Group gap="md" align="flex-start" wrap="nowrap">
          <Avatar size="md" radius="xl" color="violet" style={{ background: "transparent" }}>
            <IconSparkles size={24} style={{ color: "#a855f7" }} />
          </Avatar>
          <Stack gap={4} py={8}>
            <Text fw={700} size="sm" c="white">Orcha Agent</Text>
            <Loader size="xs" color="violet" type="dots" />
          </Stack>
        </Group>
      )}

      <SQLModal queries={sqlModal ?? []} opened={sqlModal !== null} onClose={() => setSqlModal(null)} organizationId={organizationId} configId={configId} />
    </>
  );
}
