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
  Tooltip,
  Modal,
  TextInput,
  Center,
  Loader,
  Stack
} from "@mantine/core";
import { 
  IconPlus, 
  IconShare, 
  IconLayout2, 
  IconDeviceDesktopAnalytics,
  IconDeviceFloppy,
  IconPencil,
  IconChevronDown,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconNumbers,
  IconAlignLeft,
  IconFileTypePdf,
  IconTrash,
  IconDotsVertical
} from "@tabler/icons-react";
import { Menu } from "@mantine/core";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Dynamically import the Grid to avoid SSR issues with react-grid-layout
const DashboardGrid = dynamic(
  () => import("@/components/BI/DashboardGrid").then((mod) => mod.DashboardGrid),
  { ssr: false }
);

import { WidgetIntelligencePanel } from "@/components/BI/WidgetIntelligencePanel";

export default function CommandCenterPage() {
  const { saas } = useParams();
  const organization = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const dashboards = useQuery(api.bi.listDashboards, organization ? { organizationId: organization._id } : "skip");

  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
  const dashboardData = useQuery(api.bi.getDashboard, currentDashboardId ? { dashboardId: currentDashboardId as any } : "skip");
  
  const createDashboardMutation = useMutation(api.bi.createDashboard);
  const saveWidgetMutation = useMutation(api.bi.saveWidget);
  const removeWidgetMutation = useMutation(api.bi.removeWidget);
  const deleteDashboardMutation = useMutation(api.bi.deleteDashboard);

  const [isEditMode, setIsEditMode] = useState(true);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [intelligenceOpened, setIntelligenceOpened] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("edit");
  const [createDashboardOpened, setCreateDashboardOpened] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [hasPromptedInitialDashboard, setHasPromptedInitialDashboard] = useState(false);
  const [deletingDashboardId, setDeletingDashboardId] = useState<string | null>(null);

  // Sync current dashboard selection
  useEffect(() => {
    if (dashboards && dashboards.length > 0 && !currentDashboardId) {
      setCurrentDashboardId(dashboards[0]._id);
    }
  }, [dashboards, currentDashboardId]);

  // Prompt first dashboard creation for first-time organizations.
  useEffect(() => {
    if (!organization || dashboards === undefined || hasPromptedInitialDashboard) return;
    if (dashboards.length === 0) {
      setNewDashboardName("Executive Overview");
      setCreateDashboardOpened(true);
      setHasPromptedInitialDashboard(true);
    }
  }, [organization, dashboards, hasPromptedInitialDashboard]);

  const widgets = dashboardData?.widgets || [];

  const handleCreateDashboard = async () => {
    if (!organization || !newDashboardName.trim()) return;
    setIsCreatingDashboard(true);
    try {
      const dashboardId = await createDashboardMutation({
        organizationId: organization._id,
        name: newDashboardName.trim(),
      });
      setCurrentDashboardId(dashboardId as any);
      setCreateDashboardOpened(false);
      setNewDashboardName("");
    } catch (err) {
      console.error("Failed to create dashboard:", err);
    } finally {
      setIsCreatingDashboard(false);
    }
  };

  const handleLayoutChange = async (newLayout: any) => {
    if (!organization || !currentDashboardId || !isEditMode) return;

    try {
      // Sync each layout change back to the DB
      for (const item of newLayout) {
        const widget = widgets.find(w => w._id === item.i);
        if (widget) {
          await saveWidgetMutation({
            widgetId: widget._id,
            dashboardId: currentDashboardId as any,
            organizationId: organization._id,
            type: widget.type,
            title: widget.title,
            queryId: widget.queryId,
            mapping: widget.mapping,
            layout: { 
              x: item.x, 
              y: item.y, 
              w: item.w, 
              h: item.h 
            },
            order: widget.order,
            size: widget.size,
          });
        }
      }
    } catch (err) {
      console.error("Failed to save layout:", err);
    }
  };

  const handleAddWidgetStart = (type: string) => {
    const isText = type === "text";
    const template = {
      type,
      title: isText ? "Text Box" : `New ${type.toUpperCase()}`,
      description: isText ? "Add your notes, context, or business guidance here." : undefined,
      order: widgets.length,
      size: "medium",
      // Use a finite y value to satisfy Convex number validation.
      layout: { x: (widgets.length * 3) % 12, y: widgets.length * 4, w: 4, h: 4 }
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
        description: widgetData.description,
        queryId: widgetData.queryId,
        mapping: widgetData.mapping,
        layout: widgetData.layout,
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

  const handleGeneratePdf = () => {
    // Print only the dashboard canvas (not the entire app shell/navigation).
    const style = document.createElement("style");
    style.setAttribute("data-print-dashboard-only", "true");
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #dashboard-report-print,
        #dashboard-report-print * {
          visibility: visible !important;
        }
        #dashboard-report-print {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
        }
      }
    `;
    document.head.appendChild(style);

    const cleanup = () => {
      const injected = document.querySelector('style[data-print-dashboard-only="true"]');
      if (injected?.parentNode) injected.parentNode.removeChild(injected);
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const handleDeleteDashboard = async () => {
    if (!currentDashboardId) return;
    setDeletingDashboardId(currentDashboardId);
  };

  const confirmDeleteDashboard = async () => {
    if (!deletingDashboardId) return;
    
    try {
      await deleteDashboardMutation({ dashboardId: deletingDashboardId as any });
      // Reset to the first available dashboard or null if none exist
      const remaining = dashboards?.filter(d => d._id !== deletingDashboardId) || [];
      setCurrentDashboardId(remaining.length > 0 ? remaining[0]._id : null);
      setDeletingDashboardId(null);
    } catch (err) {
      console.error("Failed to delete dashboard:", err);
      setDeletingDashboardId(null);
    }
  };

  return (
    <Box p="xl" bg="#07050f" style={{ minHeight: "100vh" }}>
      <Container size="xl">
        {/* Header Section */}
        <Group justify="space-between" align="flex-start" mb={40}>
          {/* Left: Title and Action Buttons */}
          <Box>
            <Group gap="sm" mb={4}>
              <IconDeviceDesktopAnalytics size={24} color="#a855f7" />
              <Title order={2} c="white" fw={800}>Command Center</Title>
              <Badge variant="dot" color="violet" size="sm">v1.0-alpha</Badge>
            </Group>
            <Text c="dimmed" size="sm" mb="md">Customize your organization&apos;s real-time intelligence dashboard.</Text>
            
            {/* Action buttons removed from here, moving to the right-side meatball menu */}
          </Box>

          {/* Right: Dashboard Controls */}
          <Group gap="md" align="center">
            <Select
              data={(dashboards || []).map((d: any) => ({ value: d._id, label: d.name }))}
              value={currentDashboardId}
              onChange={(v) => setCurrentDashboardId(v)}
              placeholder="Select Dashboard"
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

            <Menu position="bottom-end" shadow="xl" width={220} radius="md" transitionProps={{ transition: 'pop-top-right' }}>
              <Menu.Target>
                <ActionIcon 
                  variant="light" 
                  color="violet" 
                  size="lg" 
                  radius="md" 
                  style={{ border: "1px solid rgba(168, 85, 247, 0.3)" }}
                >
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown bg="#130f22" style={{ border: "1px solid rgba(147,51,234,0.3)", borderRadius: 12 }}>
                <Menu.Label>Dashboard Actions</Menu.Label>
                
                <Menu.Item 
                  leftSection={<IconPlus size={16} />} 
                  onClick={() => {
                    setNewDashboardName("");
                    setCreateDashboardOpened(true);
                  }}
                >
                  New Dashboard
                </Menu.Item>

                <Menu.Divider color="rgba(255,255,255,0.05)" />

                <Menu.Label>Add Insights</Menu.Label>
                <Menu.Item 
                  leftSection={<IconChartBar size={16} />} 
                  onClick={() => handleAddWidgetStart("bar")}
                >
                  Bar Chart
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconChartLine size={16} />} 
                  onClick={() => handleAddWidgetStart("line")}
                >
                  Line Chart
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconChartPie size={16} />} 
                  onClick={() => handleAddWidgetStart("pie")}
                >
                  Pie Chart
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconNumbers size={16} />} 
                  onClick={() => handleAddWidgetStart("kpi")}
                >
                  KPI Metric
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconAlignLeft size={16} />} 
                  onClick={() => handleAddWidgetStart("text")}
                >
                  Text Box
                </Menu.Item>

                <Menu.Divider color="rgba(255,255,255,0.05)" />

                <Menu.Label>Export</Menu.Label>
                <Menu.Item leftSection={<IconFileTypePdf size={16} />} onClick={handleGeneratePdf}>
                  Export PDF
                </Menu.Item>

                <Menu.Divider color="rgba(255,255,255,0.05)" />
                <Menu.Item 
                  color="red" 
                  leftSection={<IconTrash size={16} />} 
                  onClick={handleDeleteDashboard}
                >
                  Delete Dashboard
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Dynamic Grid Canvas */}
        <Box
          id="dashboard-report-print"
          style={{ 
            minHeight: 600, 
            background: isEditMode ? "rgba(147, 51, 234, 0.02)" : "transparent",
            borderRadius: 12,
            border: isEditMode ? "1px dashed rgba(147, 51, 234, 0.2)" : "1px solid transparent",
            padding: 10,
            transition: "all 0.3s ease",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {dashboards === undefined || (currentDashboardId && dashboardData === undefined) ? (
            <Center style={{ flex: 1 }}>
              <Stack align="center" gap="md">
                <Loader color="violet" size="lg" type="bars" />
                <Text size="sm" c="dimmed" fw={500}>Synchronizing Intelligence Canvas...</Text>
              </Stack>
            </Center>
          ) : (
            <>
              <DashboardGrid 
                widgets={widgets} 
                isEditMode={isEditMode}
                onLayoutChange={handleLayoutChange}
                onRemoveWidget={handleRemoveWidget}
                onSaveWidget={handleSaveWidget}
                saas={saas as string}
              />
              
              {widgets.length === 0 && (
                <Box py={100} ta="center">
                  <Text c="dimmed">This dashboard is empty.</Text>
                  <Button variant="subtle" color="violet" mt="md" onClick={() => handleAddWidgetStart("kpi")}>Add your first widget</Button>
                </Box>
              )}
            </>
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

        <Modal
          opened={createDashboardOpened}
          onClose={() => setCreateDashboardOpened(false)}
          title="Create Dashboard"
          centered
        >
          <TextInput
            label="Dashboard Name"
            placeholder="e.g. Executive Overview"
            value={newDashboardName}
            onChange={(e) => setNewDashboardName(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setCreateDashboardOpened(false)}>Cancel</Button>
            <Button
              color="violet"
              onClick={handleCreateDashboard}
              loading={isCreatingDashboard}
              disabled={!newDashboardName.trim()}
            >
              Create
            </Button>
          </Group>
        </Modal>

        <Modal
          opened={!!deletingDashboardId}
          onClose={() => setDeletingDashboardId(null)}
          title="Delete Dashboard"
          centered
          size="sm"
          overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
          styles={{
            content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 12 },
            header: { background: "#130f22", color: "white" },
            title: { fontWeight: 600 }
          }}
        >
          <Stack gap="md">
            <Text size="sm" c="rgba(255,255,255,0.7)">
              Are you sure you want to delete this dashboard? This action cannot be undone and will remove all associated widgets and data.
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" color="gray" onClick={() => setDeletingDashboardId(null)} size="xs">
                Cancel
              </Button>
              <Button color="red" onClick={confirmDeleteDashboard} size="xs">
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Container>
    </Box>
  );
}
