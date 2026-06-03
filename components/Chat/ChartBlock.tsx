"use client";

import React, { memo, useState, useEffect, useRef } from "react";
import { Box, Group, Text, Button, ActionIcon, Popover, Stack, Divider, Tooltip as MantineTooltip, ColorInput, ScrollArea } from "@mantine/core";
import { IconChartBar, IconPalette, IconCheck, IconDownload } from "@tabler/icons-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

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

export const ChartBlock = memo(function ChartBlock({
  chartType, title, xKey, yKeys, data, initialColors, messageId, parts, partIndex
}: {
  chartType: "bar" | "line" | "area" | "pie" | "radar";
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
    if (chartType === "radar") {
      return (
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey={xKey}
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, "auto"]}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }}
            axisLine={false}
          />
          <Tooltip {...chartTooltipStyle} />
          {yKeys.map((k, i) => {
            const color = seriesColors[k] || CHART_COLORS[i % CHART_COLORS.length];
            return (
              <Radar
                key={k}
                name={k}
                dataKey={k}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.15}
              />
            );
          })}
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />}
        </RadarChart>
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
        <ResponsiveContainer width="100%" height={380}>
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});
