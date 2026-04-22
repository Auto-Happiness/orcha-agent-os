"use client";

import React, { useMemo, useState } from "react";
import { 
  Responsive, 
  Layout, 
  useContainerWidth 
} from "react-grid-layout";
import { Box, Paper, Text, Group, ActionIcon, Menu, Stack } from "@mantine/core";
import { IconDotsVertical, IconTrash, IconArrowsMaximize, IconSettings } from "@tabler/icons-react";

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

export function DashboardGrid({ widgets, isEditMode, onLayoutChange, onRemoveWidget, saas }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [panelOpened, setPanelOpened] = useState(false);

  // Generate layouts from widgets
  const layouts = useMemo(() => ({
    lg: widgets.map(w => ({ i: w.id, ...w.layout })),
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
        <div key={widget.id}>
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
                      onRemoveWidget(widget.id);
                    }}
                  >
                    Remove
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>

            {/* Content Area */}
            <Box style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Text size="sm" c="dimmed">{widget.type.toUpperCase()} CHART</Text>
                <Text size="xs" c="cyan.4" mt={4}>[ Live Data Placeholder ]</Text>
              </div>
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
