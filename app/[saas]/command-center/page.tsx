"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { 
  Box, 
  Container, 
  Group, 
  Title, 
  Text, 
  Button, 
  Select, 
  Badge,
  Divider,
  ActionIcon,
  Tooltip
} from "@mantine/core";
import { 
  IconPlus, 
  IconShare, 
  IconLayout2, 
  IconDeviceDesktopAnalytics,
  IconDeviceFloppy,
  IconLockOpen,
  IconChevronDown,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconNumbers
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { Menu } from "@mantine/core";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Dynamically import the Grid to avoid SSR issues with react-grid-layout
const DashboardGrid = dynamic(
  () => import("@/components/BI/DashboardGrid").then((mod) => mod.DashboardGrid),
  { ssr: false }
);

import { WidgetIntelligencePanel } from "@/components/BI/WidgetIntelligencePanel";

/* ─── Mock Views ─────────────────────────────────────────────────────────── */

const DASHBOARD_VIEWS = [
  { value: "main", label: "Executive Overview" },
  { value: "sales", label: "Sales & Revenue" },
];

/* ─── Initial Widgets ────────────────────────────────────────────────────── */

const INITIAL_WIDGETS = [
  { id: "1", type: "kpi", title: "Monthly Revenue", layout: { x: 0, y: 0, w: 3, h: 2 } },
  { id: "2", type: "kpi", title: "Active Users", layout: { x: 3, y: 0, w: 3, h: 2 } },
  { id: "3", type: "line", title: "Growth Trend", layout: { x: 6, y: 0, w: 6, h: 4 } },
  { id: "4", type: "bar", title: "Sales by Region", layout: { x: 0, y: 2, w: 6, h: 4 } },
];

export default function CommandCenterPage() {
  const { saas } = useParams();
  const organization = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const dashboards = useQuery(api.bi.listDashboards, organization ? { organizationId: organization._id } : "skip");
  
  const [currentView, setCurrentView] = useState("main");

  // For now, we'll assume there's at least one dashboard or we create one
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
  const dashboardData = useQuery(api.bi.getDashboard, currentDashboardId ? { dashboardId: currentDashboardId as any } : "skip");
  
  const saveWidgetMutation = useMutation(api.bi.saveWidget);
  const removeWidgetMutation = useMutation(api.bi.removeWidget);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [intelligenceOpened, setIntelligenceOpened] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("edit");

  // Sync current dashboard
  useEffect(() => {
    if (dashboards && dashboards.length > 0 && !currentDashboardId) {
      setCurrentDashboardId(dashboards[0]._id);
    }
  }, [dashboards, currentDashboardId]);

  const widgets = dashboardData?.widgets || [];

  const handleLayoutChange = (newLayout: any) => {
    console.log("Layout changed:", newLayout);
    // In a real app, we would update the layout in the DB here
  };

  const handleAddWidgetStart = (type: string) => {
    const template = {
      type,
      title: `New ${type.toUpperCase()}`,
      order: widgets.length,
      size: "medium"
    };
    setSelectedWidget(template);
    setModalMode("create");
    setIntelligenceOpened(true);
  };

  const handleSaveWidget = async (widgetData: any) => {
    if (!organization || !currentDashboardId) return;

    try {
      await saveWidgetMutation({
        widgetId: modalMode === "edit" ? widgetData._id : undefined,
        dashboardId: currentDashboardId as any,
        organizationId: organization._id,
        type: widgetData.type,
        title: widgetData.title,
        queryId: widgetData.queryId,
        mapping: widgetData.mapping,
        order: widgetData.order || widgets.length,
        size: widgetData.size || "medium",
      });
      setIntelligenceOpened(false);
    } catch (err) {
      console.error("Failed to save widget:", err);
    }
  };

  const handleRemoveWidget = async (id: string) => {
    try {
      await removeWidgetMutation({ widgetId: id as any });
    } catch (err) {
      console.error("Failed to remove widget:", err);
    }
  };

  return (
    <Box p="xl" bg="#07050f" style={{ minHeight: "100vh" }}>
      <Container size="xl">
        {/* Header Section */}
        <Group justify="space-between" mb={40}>
          <Box>
            <Group gap="sm" mb={4}>
              <IconDeviceDesktopAnalytics size={24} color="#a855f7" />
              <Title order={2} c="white" fw={800}>Command Center</Title>
              <Badge variant="dot" color="violet" size="sm">v1.0-alpha</Badge>
            </Group>
            <Text c="dimmed" size="sm">Customize your organization&apos;s real-time intelligence dashboard.</Text>
          </Box>

          <Group>
            <Select
              data={DASHBOARD_VIEWS}
              value={currentView}
              onChange={(v) => setCurrentView(v ?? "main")}
              placeholder="Select View"
              leftSection={<IconLayout2 size={16} color="#a855f7" />}
              styles={{
                input: {
                  background: "rgba(147, 51, 234, 0.1)",
                  border: "1px solid rgba(147, 51, 234, 0.3)",
                  color: "white",
                  borderRadius: "8px",
                  fontWeight: 600,
                  width: 220
                },
                dropdown: { background: "#130f22", border: "1px solid rgba(147, 51, 234, 0.2)" },
              }}
            />
            
            <Divider orientation="vertical" />
            
            <Group gap="xs">
              {isEditMode ? (
                <>
                  <Button 
                    variant="filled" 
                    color="green" 
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={() => setIsEditMode(false)}
                  >
                    Save Changes
                  </Button>

                  <Menu position="bottom-end" shadow="md" width={200} radius="md">
                    <Menu.Target>
                      <Button 
                        variant="light" 
                        color="violet" 
                        leftSection={<IconPlus size={16} />}
                        rightSection={<IconChevronDown size={14} />}
                      >
                        Add Insight
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown bg="#130f22" style={{ border: "1px solid rgba(147,51,234,0.3)" }}>
                      <Menu.Label>Visualization Type</Menu.Label>
                      <Menu.Item leftSection={<IconChartBar size={16} />} onClick={() => handleAddWidgetStart("bar")}>Bar Chart</Menu.Item>
                      <Menu.Item leftSection={<IconChartLine size={16} />} onClick={() => handleAddWidgetStart("line")}>Line Chart</Menu.Item>
                      <Menu.Item leftSection={<IconChartPie size={16} />} onClick={() => handleAddWidgetStart("pie")}>Pie Chart</Menu.Item>
                      <Menu.Item leftSection={<IconNumbers size={16} />} onClick={() => handleAddWidgetStart("kpi")}>KPI Metric</Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </>
              ) : (
                <Tooltip label="Enter Designer Mode to rearrange or add widgets">
                  <Button 
                    variant="outline" 
                    color="violet" 
                    leftSection={<IconLockOpen size={16} />}
                    onClick={() => setIsEditMode(true)}
                  >
                    Configure Dashboard
                  </Button>
                </Tooltip>
              )}
            </Group>
            
            <ActionIcon variant="light" color="gray" size="lg" radius="md">
              <IconShare size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Dynamic Grid Canvas */}
        <Box 
          style={{ 
            minHeight: 600, 
            background: isEditMode ? "rgba(147, 51, 234, 0.02)" : "transparent",
            borderRadius: 12,
            border: isEditMode ? "1px dashed rgba(147, 51, 234, 0.2)" : "1px solid transparent",
            padding: 10,
            transition: "all 0.3s ease"
          }}
        >
          <DashboardGrid 
            widgets={widgets} 
            isEditMode={isEditMode}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            saas={saas as string}
          />
          
          {widgets.length === 0 && (
            <Box py={100} ta="center">
              <Text c="dimmed">This dashboard is empty.</Text>
              <Button variant="subtle" color="violet" mt="md" onClick={() => handleAddWidgetStart("kpi")}>Add your first widget</Button>
            </Box>
          )}
        </Box>
 
        {/* Intelligence Panel (Unified Create/Edit) */}
        <WidgetIntelligencePanel 
          opened={intelligenceOpened} 
          onClose={() => setIntelligenceOpened(false)} 
          widget={selectedWidget}
          mode={modalMode}
          onSave={handleSaveWidget}
          saas={saas as string}
        />
      </Container>
    </Box>
  );
}
