import { useState, useMemo } from "react";
import {
  Grid,
  Stack,
  Paper,
  Group,
  Text,
  Button,
  Textarea,
  ScrollArea,
  Table,
  Center,
  Loader,
  TextInput,
  Box,
  Tabs,
  Accordion,
  ActionIcon,
  Divider
} from "@mantine/core";
import {
  IconTerminal2,
  IconBookmark,
  IconPlayerPlay,
  IconTableExport,
  IconSearch,
  IconHistory,
  IconStar,
  IconTable,
  IconColumns,
  IconEdit,
  IconTrash
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { inputStyles } from "@/lib/styles";
import dynamic from "next/dynamic";

// Use dynamic to ensure client-side rendering for the editor component
const SqlEditor = dynamic(() => import("./SqlEditor").then(m => m.SqlEditor), { 
  ssr: false,
  loading: () => (
    <Box h={300} bg="rgba(255,255,255,0.02)" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <Stack align="center" gap="xs">
        <Loader size="sm" color="violet" />
        <Text size="xs" c="dimmed">Loading Editor...</Text>
      </Stack>
    </Box>
  )
});

interface QueryLabProps {
  currentConfig: any;
  organization: any;
  currentUser: any;
  savedQueries: any[];
  wizardData: any;
}

export function QueryLab({ currentConfig, organization, currentUser, savedQueries, wizardData }: QueryLabProps) {
  const saveQueryMutation = useMutation(api.savedQueries.save);
  const removeQueryMutation = useMutation(api.savedQueries.remove);

  const [sql, setSql] = useState("");
  const [selectedSql, setSelectedSql] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<{ columns: string[], rows: any[], executionTime?: number } | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>("schema");

  const semanticModels = useQuery(api.semanticModels.listModelsByConfig, currentConfig?._id ? { configId: currentConfig._id } : "skip");

  const insertAtCursor = (text: string) => {
    setSql(prev => prev + text);
  };

  const handleRunQuery = async () => {
    const finalSql = (selectedSql && selectedSql.trim().length > 0) ? selectedSql : sql;
    if (!finalSql.trim()) return;

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
          sql: finalSql
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
          icon: <IconBookmark size={16} /> // Replaced IconCheck with available icon or add to imports
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      const message = typeof err.message === 'string' ? err.message : JSON.stringify(err);
      notifications.show({
        title: "Query Failed",
        message: message || "An unexpected error occurred.",
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

  const handleDeleteQuery = async (e: React.MouseEvent, queryId: any) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this saved query?")) return;
    
    try {
      await removeQueryMutation({ queryId });
      notifications.show({
        title: "Query Deleted",
        message: "The saved query has been removed from your library.",
        color: "violet"
      });
    } catch (err: any) {
      const message = typeof err.message === 'string' ? err.message : JSON.stringify(err);
      notifications.show({ title: "Delete Failed", message, color: "red" });
    }
  };

  const handleExportCsv = () => {
    if (!queryResults || queryResults.rows.length === 0) return;
    
    // Create CSV rows
    const headers = queryResults.columns.join(",");
    const rows = queryResults.rows.map(row => 
      queryResults.columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape quotes and wrap in quotes
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(",")
    );
    
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `query_results_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
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
              <SqlEditor 
                value={sql || ""} 
                onChange={(v) => setSql(v || "")}
                language={currentConfig?.type || "mysql"}
                semanticModels={semanticModels || []}
                onSelectionChange={setSelectedSql}
                minHeight={300}
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
                  <Group gap="md">
                    <Text size="11px" c="dimmed" fw={500}>
                      {queryResults.rows.length} rows returned
                      <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
                      {queryResults.executionTime}ms
                    </Text>
                    <Button 
                      variant="light" 
                      color="violet" 
                      size="compact-xs" 
                      leftSection={<IconTableExport size={12} />}
                      onClick={handleExportCsv}
                    >
                      Export CSV
                    </Button>
                  </Group>
                )}
              </Group>
            </Group>
            {isExecuting ? (
              <Center h={300}><Stack align="center"><Loader size="sm" color="violet" /><Text size="xs" c="dimmed">Executing query...</Text></Stack></Center>
            ) : queryResults ? (
              <ScrollArea h={400}>
                <Table variant="simple" verticalSpacing="xs" stickyHeader stickyHeaderOffset={0}>
                  <Table.Thead style={{ zIndex: 1 }}>
                    <Table.Tr style={{ background: "#0c0a1a" }}>
                      {queryResults.columns.map(col => (
                        <Table.Th key={col} style={{ color: "white", fontSize: "11px", borderColor: "rgba(255,255,255,0.05)", background: "#0c0a1a" }}>{col}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {queryResults.rows.map((row, i) => (
                      <Table.Tr key={i}>
                        {queryResults.columns.map(col => (
                          <Table.Td key={col} style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", borderColor: "rgba(255,255,255,0.02)" }}>
                            {typeof row[col] === 'object' && row[col] !== null 
                              ? JSON.stringify(row[col]) 
                              : row[col]?.toString() ?? <Text span c="dimmed" size="10px">NULL</Text>
                            }
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
          <Tabs value={activeSidebarTab} onChange={setActiveSidebarTab} color="violet" variant="pills" styles={{ 
            root: { height: "100%", display: "flex", flexDirection: "column" },
            list: { padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
            tab: { fontSize: "10px", fontWeight: 700, textTransform: "uppercase" },
            panel: { flex: 1, padding: "12px" }
          }}>
            <Tabs.List>
                <Tabs.Tab value="schema" leftSection={<IconTable size={12} />}>Schema</Tabs.Tab>
                <Tabs.Tab value="library" leftSection={<IconHistory size={12} />}>Library</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="schema">
               <Stack gap="md">
                 <TextInput
                   placeholder="Filter tables..."
                   size="xs"
                   styles={inputStyles}
                   leftSection={<IconSearch size={12} />}
                 />
                 
                 <ScrollArea h={600}>
                   <Accordion variant="separated" styles={{ 
                     item: { border: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)", marginBottom: "4px" },
                     control: { padding: "8px 12px" },
                     label: { fontSize: "12px", color: "white", fontWeight: 600 },
                     content: { padding: "8px" }
                   }}>
                     {semanticModels?.map((model) => (
                       <Accordion.Item key={model._id} value={model.tableName}>
                         <Accordion.Control>
                            <Group gap="xs">
                                <IconTable size={14} color="#a855f7" />
                                <Text size="xs" truncate>{model.tableName}</Text>
                            </Group>
                         </Accordion.Control>
                         <Accordion.Panel>
                            <Stack gap={4}>
                               <Button 
                                 size="compact-xs" 
                                 variant="light" 
                                 color="violet" 
                                 onClick={() => insertAtCursor(model.tableName)}
                                 fullWidth
                                 mb={8}
                               >
                                 Use Table
                               </Button>
                               <Divider label="Columns" labelPosition="center" styles={{ label: { fontSize: '9px', opacity: 0.5 }}} mb={4} />
                               {model.fields.map(f => (
                                 <Group key={f.columnName} justify="space-between" wrap="nowrap" style={{ 
                                   padding: "4px 8px", 
                                   borderRadius: "4px",
                                   background: "rgba(255,255,255,0.02)",
                                   cursor: "pointer"
                                 }} onClick={() => insertAtCursor(f.columnName)}>
                                    <Text size="10px" c="dimmed" truncate>{f.columnName}</Text>
                                    <Text size="9px" c="violet" style={{ opacity: 0.6 }}>{f.type}</Text>
                                 </Group>
                               ))}
                            </Stack>
                         </Accordion.Panel>
                       </Accordion.Item>
                     ))}
                   </Accordion>
                 </ScrollArea>
               </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="library">
              <Stack gap="md">
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
                          <Group gap={4}>
                            <IconStar size={10} color="#a855f7" />
                            <ActionIcon 
                              size="xs" 
                              variant="subtle" 
                              color="red" 
                              onClick={(e) => handleDeleteQuery(e, item._id)}
                            >
                              <IconTrash size={10} />
                            </ActionIcon>
                          </Group>
                        </Group>
                        <Text size="10px" c="dimmed" truncate>{item.sql}</Text>
                        <Text size="10px" c="dimmed" mt={4}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                      </Paper>
                    )) : <Text size="xs" c="dimmed">No saved queries yet.</Text>}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
