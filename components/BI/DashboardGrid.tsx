"use client";

import React, { useMemo, useState } from "react";
import {
  Responsive,
  Layout,
  LayoutItem,
  useContainerWidth
} from "react-grid-layout";
import { Box, Paper, Text, Group, ActionIcon, Menu, Stack, Loader, Center, Table, ScrollArea } from "@mantine/core";
import { IconDotsVertical, IconTrash, IconSettings, IconChartBar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DynamicChart } from "./DynamicChart";

// Add necessary CSS for libraries
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WidgetIntelligencePanel } from "./WidgetIntelligencePanel";

interface DashboardGridProps {
  widgets: any[];
  isEditMode: boolean;
  onLayoutChange: (newLayout: Layout) => void;
  onRemoveWidget: (id: string) => void;
  onSaveWidget: (widgetData: any) => void;
  saas: string;
}

function WidgetRenderer({ widget, queryData, queryError }: { widget: any, queryData: any[], queryError: string | null }) {
  if (widget.type === "text") {
    return (
      <Box p="xs" style={{ height: "100%", overflow: "auto" }}>
        <Text size="sm" c="gray.2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {widget.description || "Add text content from Configure > Text Box."}
        </Text>
      </Box>
    );
  }

  if (queryError) {
    return (
      <Center h="100%" p="md">
        <Stack align="center" gap={4}>
          <Text size="xs" c="red.4" ta="center">{queryError}</Text>
          <Text size="10px" c="dimmed">Check query configuration</Text>
        </Stack>
      </Center>
    );
  }

  if (!widget.mapping || !widget.queryId) {
    return (
      <Center h="100%">
        <Stack align="center" gap={4}>
          <IconChartBar size={32} color="rgba(255,255,255,0.05)" />
          <Text size="xs" c="dimmed">Not Configured</Text>
          <Text size="10px" c="violet.4">Click to setup intelligence</Text>
        </Stack>
      </Center>
    );
  }

  if (widget.type === "table") {
    if (!queryData || queryData.length === 0) {
      return (
        <Center h="100%">
          <Text size="xs" c="dimmed">No table data available</Text>
        </Center>
      );
    }
    const columns = Object.keys(queryData[0]);
    return (
      <Box p="xs" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <ScrollArea h="100%" className="rounded-lg border border-white/[0.06] bg-black/20" style={{ flex: 1 }}>
          <Table variant="unstyled" style={{ color: "rgba(255,255,255,0.85)" }}>
            <Table.Thead className="bg-[#120a2a]/80 backdrop-blur-md sticky top-0 z-10 border-b border-purple-500/25">
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th
                    key={col}
                    className="text-purple-300/80 font-bold uppercase tracking-wider text-[10px] py-3.5 px-4 text-left border-b border-purple-500/20"
                    style={{ borderBottom: "1px solid rgba(147, 51, 234, 0.25)" }}
                  >
                    {col.replace(/_/g, " ")}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {queryData.map((row, rowIndex) => (
                <Table.Tr
                  key={rowIndex}
                  className="border-b border-white/[0.03] hover:bg-purple-500/[0.04] transition-colors duration-150"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  {columns.map((col) => {
                    const val = row[col];
                    const displayVal = typeof val === "number" ? val.toLocaleString() : String(val ?? "");
                    return (
                      <Table.Td key={col} className="text-slate-200 font-medium text-[11px] py-3 px-4" style={{ whiteSpace: "nowrap" }}>
                        {displayVal}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Box>
    );
  }

  if (widget.type === "kpi" || widget.type === "counter") {
    if (!queryData || queryData.length === 0) {
      return (
        <Center h="100%">
          <Text size="xs" c="dimmed">No KPI data available</Text>
        </Center>
      );
    }
    const valueKey = widget.mapping?.valueKeys?.[0] || Object.keys(queryData[0])[0];

    let rawVal = 0;
    if (queryData.length > 0) {
      const isMultiple = queryData.length > 1;
      if (isMultiple) {
        rawVal = queryData.reduce((acc, row) => acc + (parseFloat(row[valueKey]) || 0), 0);
      } else {
        rawVal = parseFloat(queryData[0][valueKey]) || 0;
      }
    }

    let displayVal = "";
    if (rawVal >= 1_000_000_000) {
      displayVal = `${(rawVal / 1_000_000_000).toFixed(1)}B`;
    } else if (rawVal >= 1_000_000) {
      displayVal = `${(rawVal / 1_000_000).toFixed(1)}M`;
    } else if (rawVal >= 1_000) {
      displayVal = `${(rawVal / 1_000).toFixed(1)}k`;
    } else if (Number.isInteger(rawVal)) {
      displayVal = rawVal.toLocaleString();
    } else {
      displayVal = rawVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const firstRowLabel = widget.mapping?.labelKey ? queryData[0]?.[widget.mapping.labelKey] : undefined;

    return (
      <Center h="100%" p="md">
        <Stack align="center" gap={2}>
          <Text size="2.5rem" fw={800} style={{
            background: "linear-gradient(135deg, #00D1FF 0%, #00FF94 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-1px"
          }}>
            {displayVal}
          </Text>
          <Text size="11px" c="dimmed" fw={500} ta="center" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
            {valueKey.replace(/_/g, " ")} {firstRowLabel ? `(${firstRowLabel})` : ""}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <DynamicChart
      data={queryData}
      type={widget.type}
      labelKey={widget.mapping.labelKey}
      valueKeys={widget.mapping.valueKeys}
      seriesColors={widget.mapping.seriesColors}
      height="100%"
    />
  );
}

export function DashboardGrid({ widgets, isEditMode, onLayoutChange, onRemoveWidget, onSaveWidget, saas }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [panelOpened, setPanelOpened] = useState(false);

  // ─── Position Overrides ──────────────────────────────────────────────────────
  // Stores per-widget layout positions the user has explicitly set via drag/resize.
  // NEVER populated automatically — only on actual user interactions.
  // New widgets (not present here) always use their authoritative DB layout.
  const [positionOverrides, setPositionOverrides] = useState<Record<string, LayoutItem>>({});

  // ─── Layout Derivation ───────────────────────────────────────────────────────
  // Purely computed from widgets (DB source of truth) + user position overrides.
  // No useEffect, no setState on render — zero risk of infinite loops or stale wipes.
  // New widgets always use the DB-stored layout (w:4, h:4) immediately on first render.
  const layoutArray = useMemo<Layout>(() =>
    widgets.map((w, index) => {
      // If user has explicitly moved/resized this widget, honour their choice
      if (positionOverrides[w._id]) {
        return { ...positionOverrides[w._id] };
      }
      // Otherwise use the DB-stored layout (fallback to safe defaults)
      const l = w.layout ?? { x: (index * 3) % 12, y: index * 4, w: 4, h: 4 };
      return { i: w._id, x: l.x, y: l.y, w: Math.max(l.w, 2), h: Math.max(l.h, 2) };
    }),
  [widgets, positionOverrides]);

  // Use a single consistent column count for all breakpoints to prevent
  // cross-breakpoint coordinate scaling that can shrink newly added widgets.
  const layouts = useMemo(() => ({
    lg: layoutArray,
    md: layoutArray,
    sm: layoutArray,
    xs: layoutArray,
    xxs: layoutArray,
  }), [layoutArray]);

  // ─── Data Fetching ───────────────────────────────────────────────────────────
  const organizationId = widgets[0]?.organizationId;
  const dashboardId = widgets[0]?.dashboardId;

  const { data: batchResult, isLoading: isBatchLoading, error: batchError } = useQuery({
    queryKey: ['dashboardBatch', dashboardId, widgets.map(w => w.queryId).join(',')],
    queryFn: async () => {
      if (!dashboardId || !organizationId || widgets.length === 0) return { results: {} };
      const response = await fetch("/api/bi/dashboard-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardId, organizationId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to execute dashboard query.");
      }
      return data;
    },
    enabled: !!dashboardId && !!organizationId && widgets.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ─── Interaction Handlers ────────────────────────────────────────────────────
  // Build the full overrides map from the complete layout array reported by the grid
  // after a user finishes dragging or resizing.
  const handleInteractionEnd = (layout: Layout) => {
    const overrides: Record<string, LayoutItem> = {};
    layout.forEach(item => { overrides[item.i] = { ...item }; });
    setPositionOverrides(overrides);
    onLayoutChange(layout);
  };

  // ─── Render Guards ───────────────────────────────────────────────────────────
  // Also guard against width <= 0: passing a zero/negative width to <Responsive>
  // makes it compute negative column widths, causing Recharts to report -1 dimensions.
  if (!mounted || width <= 0) {
    return <Box ref={containerRef as any} style={{ minHeight: 400, width: "100%" }} />;
  }

  // We removed the early-return isBatchLoading here to prevent unmounting the grid.
  // Instead, we will render a loading overlay over the grid.


  if (batchError) {
    return (
      <Center h={400} w="100%">
        <Stack align="center" gap={4}>
          <Text size="sm" c="red.4" ta="center">{(batchError as Error).message}</Text>
          <Text size="xs" c="dimmed">Failed to load dashboard data. Please try again.</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box ref={containerRef as any} style={{ position: "relative" }}>
      {isBatchLoading && widgets.length > 0 && (
        <Box 
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            background: "rgba(19, 15, 34, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            pointerEvents: "none"
          }}
        >
          <Loader color="violet" size="sm" />
        </Box>
      )}
      
      {isBatchLoading && widgets.length === 0 && (
        <Center h={400} w="100%">
          <Stack align="center" gap="md">
            <Loader color="violet" size="lg" type="bars" />
            <Text size="sm" c="dimmed" fw={500}>Synchronizing Dashboard Canvas...</Text>
          </Stack>
        </Center>
      )}

      <Responsive
        className="layout"
        layouts={layouts}
        width={width}
        // Single column count across all breakpoints — eliminates cross-breakpoint
        // coordinate scaling that previously shrank freshly added widgets.
        breakpoints={{ lg: 0, md: 0, sm: 0, xs: 0, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={100}
        margin={[16, 16]}
        // Disable auto-compaction — widgets stay exactly where placed.
        // compactType={null} prevents the grid from automatically moving
        // new widgets up into the smallest available slot (which appears "thin").
        {...({ compactType: null, preventCollision: false } as any)}
        {...({
          isDraggable: isEditMode,
          isResizable: isEditMode,
          draggableHandle: ".drag-handle",
        } as any)}
        // Only onDragStop / onResizeStop update state and persist to DB.
        // We intentionally do NOT use onLayoutChange — it fires on every render
        // (not just user interactions) and would cause an infinite setState loop.
        onDragStop={(layout: Layout) => handleInteractionEnd(layout)}
        onResizeStop={(layout: Layout) => handleInteractionEnd(layout)}
      >
        {widgets.map((widget) => (
          <div key={widget._id}>
            <Paper
              radius="lg"
              p="md"
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "rgba(19, 15, 34, 0.4)",
                border: `1px solid ${isEditMode ? "rgba(147, 51, 234, 0.4)" : "rgba(147, 51, 234, 0.15)"}`,
                backdropFilter: "blur(12px)",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              {/* Header / Drag Handle */}
              <Group justify="space-between" mb="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                <Group
                  gap="xs"
                  className={isEditMode ? "drag-handle" : ""}
                  style={{ cursor: isEditMode ? "move" : "default", flex: 1 }}
                >
                  <Text size="xs" fw={700} c="dimmed" truncate>
                    {widget.title || batchResult?.results?.[widget._id]?.queryName || "Untitled Widget"}
                  </Text>
                </Group>

                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => e.stopPropagation()}>
                      <IconDotsVertical size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown bg="#130f22" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Menu.Item
                      leftSection={<IconTrash size={14} />}
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWidget(widget._id);
                      }}
                    >
                      Remove
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>

              {/* Content Area — two-layer absolute fill pattern:
                  outer: flex:1 + minHeight:0 so the flex item shrinks/grows correctly.
                  inner: position:absolute inset:0 gives Recharts ResponsiveContainer
                  a real pixel height to measure, fixing the width/height:-1 error. */}
              <Box style={{ flex: 1, position: "relative", minHeight: 0 }}>
                <Box style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                  <WidgetRenderer
                    widget={widget}
                    queryData={batchResult?.results?.[widget._id]?.rows || []}
                    queryError={batchResult?.results?.[widget._id]?.error || null}
                  />
                </Box>
              </Box>

              {/* Edit Mode Overlay */}
              {isEditMode && (
                <Box
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: "none",
                    border: "2px dashed rgba(147, 51, 234, 0.2)",
                    borderRadius: "inherit",
                  }}
                />
              )}
            </Paper>
          </div>
        ))}
      </Responsive>

      <WidgetIntelligencePanel
        opened={panelOpened}
        onClose={() => setPanelOpened(false)}
        widget={selectedWidget}
        mode="edit"
        onSave={onSaveWidget}
        saas={saas}
      />
    </Box>
  );
}
