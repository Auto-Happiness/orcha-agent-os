"use client";

import React, { useMemo, useState } from "react";
import { 
  Responsive, 
  Layout, 
  useContainerWidth 
} from "react-grid-layout";
import { Box, Paper, Text, Group, ActionIcon, Menu, Stack, Loader, Center } from "@mantine/core";
import { IconDotsVertical, IconTrash, IconArrowsMaximize, IconSettings, IconChartBar } from "@tabler/icons-react";
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

  // 1. Unified Dashboard Mega-Query
  // Fetch all widget data in a single batch
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
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Generate layouts from widgets
  const layouts = useMemo(() => ({
    lg: widgets.map(w => ({ i: w._id, ...w.layout })),
  }), [widgets]);

  if (!mounted) {
    return <Box ref={containerRef as any} h={400} />;
  }

  if (isBatchLoading) {
    return (
      <Center h={400} w="100%">
        <Stack align="center" gap="md">
          <Loader color="violet" size="lg" type="bars" />
          <Text size="sm" c="dimmed" fw={500}>Synchronizing Dashboard Canvas...</Text>
        </Stack>
      </Center>
    );
  }

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

  const handleWidgetClick = (widget: any) => {
    setSelectedWidget(widget);
    setPanelOpened(true);
  };

  return (
    <Box ref={containerRef as any}>
      <Responsive
        className="layout"
        layouts={layouts}
        width={width}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        margin={[20, 20]}
        dragConfig={{ 
          enabled: isEditMode, 
          handle: ".drag-handle" 
        }}
        resizeConfig={{ 
          enabled: isEditMode 
        }}
        onLayoutChange={(currentLayout: Layout) => onLayoutChange(currentLayout)}
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
            <Group justify="space-between" mb="xs" wrap="nowrap">
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
                    leftSection={<IconSettings size={14} />}
                    c="white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWidgetClick(widget);
                    }}
                  >
                    Configure
                  </Menu.Item>
                  <Menu.Divider style={{ borderColor: "rgba(255,255,255,0.05)" }} />
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

            {/* Content Area */}
            <Box style={{ flex: 1, position: "relative" }}>
              <WidgetRenderer 
                widget={widget} 
                queryData={batchResult?.results?.[widget._id]?.rows || []} 
                queryError={batchResult?.results?.[widget._id]?.error || null} 
              />
            </Box>

            {/* Edit Mode Overlay (Subtle) */}
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
