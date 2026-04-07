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
  Loader
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
  IconSql
} from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import { SemanticBridge } from "@/components/Configure/SemanticBridge";
import { DatabaseConnectionForm } from "@/components/Configure/DatabaseConnectionForm";
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

  // Query Lab State
  const [sql, setSql] = useState("-- Type your SQL here\nSELECT * FROM orders LIMIT 10;");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<{ columns: string[], rows: any[], executionTime?: number } | null>(null);

  // Convex Data
  const organization = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const allConfigs = useQuery(api.databaseConfigs.listByOrganization, organization ? { organizationId: organization._id } : "skip");
  const currentConfig = allConfigs?.find(c => c._id === configId);
  const savedQueries = useQuery(api.savedQueries.listByConfig, currentConfig ? { configId: currentConfig._id } : "skip");

  useEffect(() => {
    if (currentConfig) {
      setName(currentConfig.name);
      setDescription(currentConfig.description || "");
      setBusinessContext(currentConfig.businessContext || "");
      setTags(currentConfig.tags || []);
      
      try {
        const dbConfig = JSON.parse(currentConfig.encryptedUri);
        updateData({ 
          dbProvider: currentConfig.type,
          dbConfig,
          businessContext: currentConfig.businessContext || "",
          configId: currentConfig._id
        });
      } catch (e) {
        console.error("Sync Error:", e);
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

  const handleRunQuery = async () => {
    setIsExecuting(true);
    setQueryResults(null);
    const startTime = performance.now();
    try {
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: currentConfig.type,
          config: wizardData.dbConfig,
          sql: sql
        })
      });

      const result = await response.json();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (result.success) {
        setQueryResults({ 
          columns: result.columns, 
          rows: result.rows,
          executionTime: duration
        });
        notifications.show({
          title: "Query Success",
          message: `${result.rowCount} rows returned in ${duration}ms.`,
          color: "green",
          icon: <IconCheck size={16} />
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      notifications.show({
        title: "Query Failed",
        message: err.message,
        color: "red"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!currentUser?._id || !organization?._id) return;
    
    const queryName = prompt("Enter a name for this query:", "New Query");
    if (!queryName) return;

    try {
      await saveQueryMutation({
        organizationId: organization._id,
        configId: currentConfig._id,
        name: queryName,
        sql,
        createdBy: currentUser._id,
      });
      notifications.show({
         title: "Query Saved",
         message: `"${queryName}" has been added to your library.`,
         color: "violet"
      });
    } catch (err: any) {
      notifications.show({ title: "Save Failed", message: err.message, color: "red" });
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
        <Paper withBorder p="2.5rem" radius="md" style={{ background: "rgba(255,255,255,0.012)", borderColor: "rgba(147,51,234,0.12)" }}>
            <Group align="flex-start" gap="2.5rem">
               <Avatar src={currentConfig.image || identiconUrl} size={rem(140)} radius="lg" style={{ border: "2px solid rgba(147,51,234,0.3)", background: "rgba(147,51,234,0.05)" }} />
               <Stack gap={8}>
                 <Group gap="xs">
                   <Title order={1} c="white" size="2.5rem">{currentConfig.name}</Title>
                   <Badge variant="dot" color="green" size="md">STABLE</Badge>
                 </Group>
                 <Group gap="xl">
                    <Group gap={6}><IconWorld size={14} color="rgba(255,255,255,0.4)" /><Text size="xs" c="dimmed">Region: US-EAST-1</Text></Group>
                    <Group gap={6}><IconCheck size={14} color="#a855f7" /><Text size="xs" c="dimmed">Semantic Sync: Ready</Text></Group>
                    <Group gap={6}><IconDatabase size={14} color="rgba(255,255,255,0.4)" /><Text size="xs" c="dimmed">{currentConfig.type.toUpperCase()}</Text></Group>
                 </Group>
               </Stack>
            </Group>
        </Paper>

        <Tabs value={activeTab} onChange={setActiveTab} color="violet" variant="outline" styles={{
           tab: { border: "none", color: "rgba(255,255,255,0.4)", "&[data-active]": { borderBottom: "2px solid #a855f7", color: "white" } },
           panel: { paddingTop: "2rem" }
        }}>
           <Tabs.List>
             <Tabs.Tab value="general" leftSection={<IconFileDescription size={16} />}>Deployment Profile</Tabs.Tab>
             <Tabs.Tab value="modeler" leftSection={<IconHierarchy2 size={16} />}>Semantic Modeler</Tabs.Tab>
             <Tabs.Tab value="lab" leftSection={<IconTerminal2 size={16} />}>Query Lab</Tabs.Tab>
             <Tabs.Tab value="health" leftSection={<IconAdjustmentsHorizontal size={16} />}>Connectivity & Pulse</Tabs.Tab>
           </Tabs.List>

           {/* ── Tab: Profile ────────────────────────────────────────── */}
           <Tabs.Panel value="general">
              <Grid styles={{ inner: { gap: "var(--mantine-spacing-xl)" } }}>
                 <Grid.Col span={8}>
                    <Paper withBorder p="2.5rem" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
                       <Stack gap="xl">
                          <TextInput label="Friendly Name" size="md" styles={inputStyles} value={name} onChange={(e) => setName(e.target.value)} />
                          <Textarea label="Environment Description" styles={inputStyles} minRows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                          <Textarea label="Librarian's Common Sense Context" styles={inputStyles} minRows={6} value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} />
                       </Stack>
                    </Paper>
                 </Grid.Col>
                 
                 <Grid.Col span={4}>
                    <Stack gap="xl">
                        <Paper withBorder p="xl" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
                           <Stack gap="md">
                              <Text size="xs" fw={700} c="dimmed">Environment Tags</Text>
                              <Group gap="xs">
                                {tags.map((tag) => (
                                  <Badge key={tag} variant="light" color="violet" radius="xs" rightSection={<ActionIcon size="xs" variant="transparent" onClick={() => setTags(tags.filter(t => t !== tag))}>×</ActionIcon>}>{tag}</Badge>
                                ))}
                              </Group>
                              <TextInput placeholder="Add +" size="xs" styles={inputStyles} onKeyDown={(e) => { if (e.key === "Enter") { const val = e.currentTarget.value.trim(); if (val && !tags.includes(val)) { setTags([...tags, val]); e.currentTarget.value = ""; } } }} />
                           </Stack>
                        </Paper>
                        <Paper withBorder p="xl" radius="md" style={{ background: "rgba(147, 51, 234, 0.05)", borderColor: "rgba(147,51,234,0.2)" }}>
                           <Stack gap="xs">
                              <Group gap="xs"><IconCheck size={16} color="#a855f7" /><Text size="sm" fw={700} c="white">Sync Status</Text></Group>
                              <Text size="xs" c="dimmed">Your semantic bridge is synchronized with your database schema.</Text>
                           </Stack>
                        </Paper>
                    </Stack>
                 </Grid.Col>
              </Grid>
           </Tabs.Panel>

           {/* ── Tab: Modeler ────────────────────────────────────────────── */}
           <Tabs.Panel value="modeler">
              <Box style={{ background: "rgba(255,255,255,0.01)", borderRadius: "12px" }}>
                {currentConfig && <SemanticBridge configId={currentConfig._id} />}
              </Box>
           </Tabs.Panel>

           {/* ── Tab: Query Lab ──────────────────────────────────────────── */}
           <Tabs.Panel value="lab">
              <Grid styles={{ inner: { gap: "var(--mantine-spacing-xs)" } }}>
                 <Grid.Col span={9}>
                    <Stack gap="xs">
                       <Paper withBorder radius="md" style={{ background: "#0c0a1a", borderColor: "rgba(255,255,255,0.05)" }}>
                          <Group p="xs" justify="space-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                             <Group gap="xs">
                                <IconTerminal2 size={16} color="#a855f7" />
                                <Text size="xs" fw={700} c="white" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>SQL Editor</Text>
                             </Group>
                             <Group gap="xs">
                                <Button size="compact-xs" variant="subtle" color="dimmed" leftSection={<IconBookmark size={12} />} onClick={handleSaveQuery}>Save Query</Button>
                                <Button 
                                  size="compact-xs" 
                                  color="violet" 
                                  leftSection={<IconPlayerPlay size={12} />}
                                  loading={isExecuting}
                                  onClick={handleRunQuery}
                                >
                                  Run Query
                                </Button>
                             </Group>
                          </Group>
                          <Box p={0}>
                             <Textarea 
                               placeholder="SELECT * FROM my_table..."
                               minRows={12}
                               variant="unstyled"
                               p="md"
                               value={sql}
                               onChange={(e) => setSql(e.target.value)}
                               styles={{ 
                                 input: { 
                                   fontFamily: "monospace", 
                                   fontSize: "13px", 
                                   color: "#c084fc", 
                                   background: "transparent",
                                   resize: "vertical",
                                   minHeight: "150px"
                                 } 
                               }}
                             />
                          </Box>
                       </Paper>

                       <Paper withBorder radius="md" style={{ background: "#0c0a1a", borderColor: "rgba(255,255,255,0.05)", flex: 1, minHeight: "400px" }}>
                          <Group p="xs" justify="space-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                             <Group gap="xs">
                                <IconTableExport size={16} color="rgba(255,255,255,0.3)" />
                                <Text size="xs" fw={700} c="dimmed">Query Results</Text>
                             </Group>
                             <Group gap="xs">
                                {queryResults && (
                                  <Text size="11px" c="dimmed" fw={500}>
                                    {queryResults.rows.length} rows returned 
                                    <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span> 
                                    {queryResults.executionTime}ms
                                  </Text>
                                )}
                             </Group>
                          </Group>
                          {isExecuting ? (
                            <Center h={300}><Stack align="center"><Loader size="sm" color="violet" /><Text size="xs" c="dimmed">Executing query...</Text></Stack></Center>
                          ) : queryResults ? (
                            <ScrollArea h={400}>
                               <Table variant="simple" verticalSpacing="xs">
                                  <Table.Thead>
                                     <Table.Tr>
                                        {queryResults.columns.map(col => (
                                          <Table.Th key={col} style={{ color: "white", fontSize: "11px", borderColor: "rgba(255,255,255,0.05)" }}>{col}</Table.Th>
                                        ))}
                                     </Table.Tr>
                                  </Table.Thead>
                                  <Table.Tbody>
                                     {queryResults.rows.map((row, i) => (
                                       <Table.Tr key={i}>
                                          {queryResults.columns.map(col => (
                                            <Table.Td key={col} style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", borderColor: "rgba(255,255,255,0.02)" }}>
                                              {row[col]?.toString()}
                                            </Table.Td>
                                          ))}
                                       </Table.Tr>
                                     ))}
                                  </Table.Tbody>
                               </Table>
                            </ScrollArea>
                          ) : (
                            <Center h={200}>
                               <Stack align="center" gap="xs">
                                  <IconSearch size={32} color="rgba(255,255,255,0.1)" />
                                  <Text size="xs" c="dimmed">Run a query to see structured results here.</Text>
                               </Stack>
                            </Center>
                          )}
                       </Paper>
                    </Stack>
                 </Grid.Col>

                 <Grid.Col span={3}>
                    <Paper withBorder h="100%" radius="md" style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.05)" }}>
                       <Stack p="md" gap="md">
                          <Group justify="space-between">
                             <Text size="xs" fw={700} c="white" style={{ textTransform: "uppercase" }}>Query Library</Text>
                             <IconHistory size={14} color="rgba(255,255,255,0.3)" />
                          </Group>
                          
                          <TextInput 
                            placeholder="Find saved query..." 
                            size="xs" 
                            styles={inputStyles} 
                            leftSection={<IconSearch size={12} />}
                          />

                          <ScrollArea h={600}>
                             <Stack gap="xs">
                                {savedQueries ? savedQueries.map((item) => (
                                  <Paper key={item._id} p="xs" radius="xs" style={{ background: "rgba(147,51,234,0.03)", cursor: "pointer", border: "1px solid transparent" }} 
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(147,51,234,0.3)"}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
                                    onClick={() => setSql(item.sql)}
                                  >
                                    <Group justify="space-between" mb={4}>
                                       <Text size="xs" fw={700} c="white">{item.name}</Text>
                                       <IconStar size={10} color="#a855f7" />
                                    </Group>
                                    <Text size="10px" c="dimmed" truncate>{item.sql}</Text>
                                    <Text size="10px" c="dimmed" mt={4}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                                  </Paper>
                                )) : <Text size="xs" c="dimmed">No saved queries yet.</Text>}
                             </Stack>
                          </ScrollArea>
                       </Stack>
                    </Paper>
                 </Grid.Col>
              </Grid>
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

      <Modal opened={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeleteConfirmName(""); }} title="Permanently Delete Environment?" centered styles={{ content: { background: "#13102a" }, title: { color: "white" } }}>
        <Stack gap="lg">
          <Text size="sm" c="dimmed">Type <b>{currentConfig.name}</b> to confirm deletion.</Text>
          <TextInput placeholder={currentConfig.name} styles={inputStyles} value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} autoFocus />
          <Group justify="flex-end">
            <Button variant="subtle" color="dimmed" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button color="red" loading={isDeleting} disabled={deleteConfirmName !== currentConfig.name} onClick={handleDelete}>Delete Permanently</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
