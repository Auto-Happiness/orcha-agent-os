"use client";

import { 
  Container, 
  Stack, 
  Title, 
  Text, 
  Group, 
  Button, 
  TextInput, 
  Textarea, 
  Avatar, 
  Box, 
  rem, 
  Divider,
  Paper,
  ActionIcon,
  Badge,
  Modal,
  Menu,
  Tabs,
  Grid,
  Center,
  ScrollArea,
  Table,
  ActionIcon as MantineActionIcon,
  Tooltip,
  Loader,
  ThemeIcon
} from "@mantine/core";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { 
  IconArrowLeft, 
  IconTrash, 
  IconDeviceFloppy, 
  IconPencil, 
  IconTags, 
  IconDatabase, 
  IconRobot, 
  IconDotsVertical,
  IconHierarchy2,
  IconActivity,
  IconChartDots,
  IconFileDescription,
  IconCheck,
  IconWorld,
  IconAdjustmentsHorizontal,
  IconTerminal2,
  IconHistory,
  IconPlayerPlay,
  IconTableExport,
  IconBookmark,
  IconSearch,
  IconStar,
  IconSql,
  IconBrain,
  IconAlertTriangle,
  IconTrashX
} from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import { SemanticBridge } from "@/components/Configure/SemanticBridge";
import { DatabaseConnectionForm } from "@/components/Configure/DatabaseConnectionForm";
import { QueryLab } from "@/components/Configure/QueryLab";
import { DeploymentProfile } from "@/components/Configure/DeploymentProfile";
import { DashboardHeader } from "@/components/Configure/DashboardHeader";
import { MemoryStatus } from "@/components/Configure/MemoryStatus";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { useUser } from "@clerk/nextjs";

export default function EditConfigurationPage() {
  const { saas, configId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  
  const finalizeMutation = useMutation(api.databaseConfigs.finalizeConfiguration);
  const removeMutation = useMutation(api.databaseConfigs.remove);
  const saveQueryMutation = useMutation(api.savedQueries.save);
  const currentUser = useQuery(api.users.getCurrentUser);
  const { data: wizardData, updateData } = useCreationWizard();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>("general");


  // Convex Data
  const organization = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const allConfigs = useQuery(api.databaseConfigs.listByOrganization, organization ? { organizationId: organization._id } : "skip");
  const currentConfig = allConfigs?.find(c => c._id === configId);
  const savedQueries = useQuery(api.savedQueries.listByConfig, currentConfig ? { configId: currentConfig._id } : "skip");

  // ── Diagnostics & Stability ─────────────────────────────────────────────
  useEffect(() => {
    const handleError = (event: PromiseRejectionEvent) => {
      // Basic check for serious issues
      if (event.reason?.message?.includes('Clerk') || event.reason?.message?.includes('Convex')) {
        console.error("Critical Rejection:", event.reason);
      }
    };

    window.addEventListener("unhandledrejection", handleError);
    return () => window.removeEventListener("unhandledrejection", handleError);
  }, []);

  useEffect(() => {
    if (currentConfig) {
      // Safe Name/Description/Tags Update
      setName(String(currentConfig.name || ""));
      setDescription(String(currentConfig.description || ""));
      setBusinessContext(String(currentConfig.businessContext || ""));
      setTags(Array.isArray(currentConfig.tags) ? currentConfig.tags : []);
      
      try {
        if (currentConfig.encryptedUri) {
          const dbConfig = JSON.parse(currentConfig.encryptedUri);
          console.log("[Diagnostics] Syncing dbConfig to store:", dbConfig);
          
          updateData({ 
            dbProvider: currentConfig.type || "mysql",
            dbConfig,
            businessContext: currentConfig.businessContext || "",
            configId: currentConfig._id
          });
        }
      } catch (e) {
        console.error("Configuration Sync Warning:", e);
      }
    }
  }, [currentConfig, updateData]);

  if (currentConfig === undefined) return <Container p="xl"><Center h={400}><Stack align="center"><Text c="dimmed">Syncing deployment state...</Text></Stack></Center></Container>;
  if (currentConfig === null) return <Container p="xl"><Text c="red">Deployment profile not found.</Text></Container>;

  const handleSave = async () => {
    try {
      await finalizeMutation({
        configId: currentConfig._id,
        name,
        description,
        businessContext,
        tags,
      });
      notifications.show({
        title: "Deployment Updated",
        message: "Environmental changes successfully synchronized.",
        color: "violet"
      });
      router.push(`/${saas}/configure`);
    } catch (err: any) {
      notifications.show({ title: "Update Failed", message: err.message, color: "red" });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeMutation({ configId: currentConfig._id });
      notifications.show({ title: "Environment Removed", message: `${currentConfig.name} deleted.`, color: "red" });
      router.push(`/${saas}/configure`);
    } catch (err: any) {
      notifications.show({ title: "Deletion Failed", message: err.message, color: "red" });
      setIsDeleting(false);
    }
  };


  const identiconUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${name || 'orcha'}&backgroundColor=13102a`;

  return (
    <Box p="4rem" style={{ maxWidth: "1600px" }}>
      <Stack gap="xl">
        <Group justify="space-between">
          <Button 
            variant="subtle" 
            color="dimmed" 
            leftSection={<IconArrowLeft size={16} />}
            component={Link}
            href={`/${saas}/configure`}
          >
            Back to Configurations
          </Button>

          <Menu shadow="md" width={240} position="bottom-end" styles={{
            dropdown: { background: "#13102a", borderColor: "rgba(147,51,234,0.2)" },
            item: { color: "white", transition: "all 0.2s ease" }
          }}>
            <Menu.Target>
              <ActionIcon variant="light" color="violet" size="lg" radius="md">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Deployment Actions</Menu.Label>
              <Menu.Item leftSection={<IconDeviceFloppy size={14} color="#9333ea" />} onClick={handleSave}>
                Save Profile Changes
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label color="red">Danger Zone</Menu.Label>
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteModalOpen(true)}>
                Delete Environment
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* ── Dashboard Header ─────────────────────────────────────── */}
        <DashboardHeader currentConfig={currentConfig} identiconUrl={identiconUrl} />

        <Tabs value={activeTab} onChange={setActiveTab} color="violet" variant="pills" styles={{
           tab: { color: "rgba(255,255,255,0.4)" },
           panel: { paddingTop: "2rem" }
        }}>
           <Tabs.List>
             <Tabs.Tab value="general" leftSection={<IconFileDescription size={16} />}>Deployment Profile</Tabs.Tab>
             <Tabs.Tab value="modeler" leftSection={<IconHierarchy2 size={16} />}>Semantic Modeler</Tabs.Tab>
             <Tabs.Tab value="lab" leftSection={<IconTerminal2 size={16} />}>Query Lab</Tabs.Tab>
             <Tabs.Tab value="memory" leftSection={<IconBrain size={16} />}>Semantic Memory</Tabs.Tab>
             <Tabs.Tab value="health" leftSection={<IconAdjustmentsHorizontal size={16} />}>Connectivity & Pulse</Tabs.Tab>
           </Tabs.List>

           {/* ── Tab: Profile ────────────────────────────────────────── */}
           <Tabs.Panel value="general">
              <DeploymentProfile 
                name={name} 
                setName={setName} 
                description={description} 
                setDescription={setDescription} 
                businessContext={businessContext} 
                setBusinessContext={setBusinessContext} 
                tags={tags} 
                setTags={setTags} 
              />
           </Tabs.Panel>

           {/* ── Tab: Modeler ────────────────────────────────────────────── */}
           <Tabs.Panel value="modeler">
              <Box style={{ background: "rgba(255,255,255,0.01)", borderRadius: "12px" }}>
                {currentConfig && <SemanticBridge configId={currentConfig._id} />}
              </Box>
           </Tabs.Panel>

           {/* ── Tab: Query Lab ──────────────────────────────────────────── */}
           <Tabs.Panel value="lab">
              <QueryLab 
                currentConfig={currentConfig}
                organization={organization}
                currentUser={currentUser}
                savedQueries={savedQueries || []}
                wizardData={wizardData}
              />
            </Tabs.Panel>

            {/* ── Tab: Memory ────────────────────────────────────────────── */}
            <Tabs.Panel value="memory">
               {currentConfig && organization && (
                 <MemoryStatus currentConfig={currentConfig} activeOrgId={organization._id} />
               )}
            </Tabs.Panel>

           {/* ── Tab: Connectivity ──────────────────────────────────────────── */}
           <Tabs.Panel value="health">
              <Grid styles={{ inner: { gap: "var(--mantine-spacing-xl)" } }}>
                 <Grid.Col span={8}>
                    <Paper withBorder p="2.5rem" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
                       {currentConfig && <DatabaseConnectionForm provider={currentConfig.type} />}
                    </Paper>
                 </Grid.Col>
                 <Grid.Col span={4}>
                    <Paper withBorder p="xl" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
                       <Stack gap="md">
                          <Text size="xs" fw={700} c="dimmed">Connection Integrity</Text>
                          <Stack gap="xs">
                             <Group justify="space-between"><Text size="xs" c="dimmed">Status</Text><Badge size="xs" color="green">ONLINE</Badge></Group>
                             <Group justify="space-between"><Text size="xs" c="dimmed">Latency</Text><Text size="xs" c="white">42ms</Text></Group>
                          </Stack>
                          <Divider style={{ opacity: 0.1 }} mt="md" />
                          <Button variant="light" color="violet" size="xs" fullWidth leftSection={<IconActivity size={12} />}>Sync Logs</Button>
                       </Stack>
                    </Paper>
                 </Grid.Col>
              </Grid>
           </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal 
        opened={deleteModalOpen} 
        onClose={() => { setDeleteModalOpen(false); setDeleteConfirmName(""); }} 
        title="Permanently Delete Environment?"
        centered 
        size="md"
        radius="lg"
        overlayProps={{
          color: "#05010d",
          opacity: 0.85,
          blur: 10,
        }}
        styles={{ 
          content: { background: "#0c0814", border: "1px solid rgba(255,0,0,0.2)", padding: "1rem" }, 
          header: { background: "#0c0814", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem" },
          title: { color: "white" } 
        }}
      >
        <Stack gap="xl">
          <Box p="md" style={{ background: "rgba(255,0,0,0.05)", borderRadius: "8px", border: "1px solid rgba(255,0,0,0.1)" }}>
             <Stack gap="xs">
                <Text size="sm" c="red.4" fw={700}>This action cannot be undone.</Text>
                <Text size="xs" c="dimmed" lh={1.6}>
                   Deleting the <b>{currentConfig.name}</b> environment will permanently remove all semantic models, 
                   saved queries, and configuration metadata. Connected applications using these definition IDs will stop functioning immediately.
                </Text>
             </Stack>
          </Box>

          <Stack gap={8}>
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: rem(1) }}>
              Confirm Environment Name
            </Text>
            <TextInput 
              placeholder={currentConfig.name} 
              styles={inputStyles} 
              value={deleteConfirmName} 
              onChange={(e) => setDeleteConfirmName(e.target.value)} 
              autoFocus 
            />
          </Stack>

          <Group justify="flex-end" gap="md">
            <Button variant="subtle" color="gray" onClick={() => setDeleteModalOpen(false)}>
              Keep Environment
            </Button>
            <Button 
              color="red" 
              variant="filled"
              loading={isDeleting} 
              disabled={deleteConfirmName !== currentConfig.name} 
              onClick={handleDelete}
              leftSection={<IconTrashX size={16} />}
              style={{ boxShadow: deleteConfirmName === currentConfig.name ? "0 0 20px rgba(239, 68, 68, 0.3)" : "none" }}
            >
              Delete Permanently
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
