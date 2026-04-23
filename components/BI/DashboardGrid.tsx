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
  saas: string;
}

function WidgetRenderer({ widget, organizationId }: { widget: any, organizationId: string }) {
  const { data: result, isLoading, error } = useQuery({
    queryKey: ['widgetData', widget._id, widget.queryId, widget.mapping],
    queryFn: async () => {
      if (!widget.queryId || !widget.mapping) return null;
      const response = await fetch("/api/bi/widget-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetId: widget._id,
          organizationId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load widget data.");
      }
      return data;
    },
    enabled: !!widget.queryId && !!widget.mapping,
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });

  const queryData = result?.success ? result.rows : [];
  const queryError = error ? (error as Error).message : (result?.success === false ? result.message : null);

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader size="sm" color="violet" />
      </Center>
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

export function DashboardGrid({ widgets, isEditMode, onLayoutChange, onRemoveWidget, saas }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [panelOpened, setPanelOpened] = useState(false);

  // Generate layouts from widgets
  const layouts = useMemo(() => ({
    lg: widgets.map(w => ({ i: w._id, ...w.layout })),
  }), [widgets]);

  if (!mounted) {
    return <Box ref={containerRef as any} h={400} />;
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
            onClick={() => handleWidgetClick(widget)}
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
                  {widget.title || "Untitled Widget"}
                </Text>
              </Group>

              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => e.stopPropagation()}>
                    <IconDotsVertical size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown bg="#130f22" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Menu.Item leftSection={<IconArrowsMaximize size={14} />} c="white">Expand</Menu.Item>
                  <Menu.Item leftSection={<IconSettings size={14} />} c="white">Configure</Menu.Item>
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
              <WidgetRenderer widget={widget} organizationId={widgets[0]?.organizationId} />
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
        saas={saas}
      />
    </Box>
  );
}
