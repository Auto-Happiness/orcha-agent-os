import { useState, useMemo, useRef, useEffect } from "react";
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
  Divider,
  Alert,
  Modal,
  Pagination,
  Select
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
  IconTrash,
  IconAlertCircle
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { useIntersection } from "@mantine/hooks";
import { api } from "@/convex/_generated/api";
import { inputStyles } from "@/lib/styles";
import dynamic from "next/dynamic";
import { buildCountSql, buildPageSql } from "../Databook/paginationHelpers";

// Use dynamic to ensure client-side rendering for the editor component
const SqlEditor = dynamic(() => import("./SqlEditor").then(m => m.SqlEditor), {
  ssr: false,
  loading: () => (
    <Box h={300} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--orcha-border)', background: "var(--orcha-surface)" }}>
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
  const renameQueryMutation = useMutation(api.savedQueries.rename);
  const removeQueryMutation = useMutation(api.savedQueries.remove);

  const [sql, setSql] = useState("");
  const [selectedSql, setSelectedSql] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<{ columns: string[], rows: any[], executionTime?: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [activeSql, setActiveSql] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>("schema");
  const [librarySearch, setLibrarySearch] = useState("");

  const totalPages = useMemo(() => {
    if (totalRows === null) return 1;
    return Math.ceil(totalRows / rowsPerPage);
  }, [totalRows, rowsPerPage]);

  const startIndex = (currentPage - 1) * rowsPerPage;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState<any>(null);

  const filteredQueries = useMemo(() => {
    // Only display standard connection queries; exclude AI/federated queries to avoid confusion
    const list = savedQueries?.filter(q => !q.isFederated) || [];
    if (!librarySearch.trim()) return list;
    return list.filter(q => 
      q.name.toLowerCase().includes(librarySearch.toLowerCase()) || 
      (q.sql && q.sql.toLowerCase().includes(librarySearch.toLowerCase()))
    );
  }, [savedQueries, librarySearch]);

  const { results: semanticModels, status: modelsStatus, loadMore: loadMoreModels } = usePaginatedQuery(
    api.semanticModels.listModelSummariesByConfig, 
    currentConfig?._id ? { configId: currentConfig._id } : "skip",
    { initialNumItems: 50 }
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: sentinelRef, entry } = useIntersection({
    root: containerRef.current,
    threshold: 0.1,
  });

  useEffect(() => {
    if (entry?.isIntersecting && modelsStatus === "CanLoadMore") {
      loadMoreModels(50);
    }
  }, [entry, modelsStatus]);

  const insertAtCursor = (text: string) => {
    setSql(prev => prev + text);
  };

  const validateSql = (sqlText: string) => {
    const trimmed = sqlText.trim().toUpperCase();
    if (!trimmed) return { valid: false, message: "Query cannot be empty." };

    const isSelectOrCte = trimmed.startsWith("SELECT") || trimmed.startsWith("WITH");
    if (!isSelectOrCte) {
      return { valid: false, message: "Only SELECT queries are allowed for security reasons." };
    }

    if (trimmed.includes(";") && trimmed.split(";").filter(s => s.trim()).length > 1) {
      return { valid: false, message: "Multiple SQL statements are not allowed." };
    }

    const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "REPLACE", "GRANT", "REVOKE"];
    for (const keyword of forbidden) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(trimmed)) {
        return { valid: false, message: `The keyword '${keyword}' is prohibited in the Query Lab.` };
      }
    }

    return { valid: true };
  };

  const fetchPage = async (page: number, limit: number, querySql: string) => {
    setIsExecuting(true);
    const startTime = performance.now();
    const offset = (page - 1) * limit;
    try {
      const pageSql = buildPageSql(querySql, offset, limit, currentConfig.type);
      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: currentConfig.type,
          config: wizardData.dbConfig,
          sql: pageSql
        })
      });
      const result = await res.json();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (result.success) {
        setQueryResults({
          columns: result.columns,
          rows: result.rows,
          executionTime: duration
        });
        setCurrentPage(page);
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      notifications.show({
        title: "Query Failed",
        message: err.message || "An error occurred fetching the query results.",
        color: "red"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunQuery = async () => {
    const finalSql = (selectedSql && selectedSql.trim().length > 0) ? selectedSql : sql;
    const validation = validateSql(finalSql);

    if (!validation.valid) {
      notifications.show({ title: "Query Blocked", message: validation.message, color: "orange" });
      return;
    }

    setIsExecuting(true);
    setQueryResults(null);
    setTotalRows(null);
    setCurrentPage(1);
    setActiveSql(finalSql);

    try {
      // 1. Start fetching count query in background
      const countPromise = (async () => {
        try {
          const countSql = buildCountSql(finalSql, currentConfig.type);
          const res = await fetch("/api/db/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: currentConfig.type,
              config: wizardData.dbConfig,
              sql: countSql
            })
          });
          const result = await res.json();
          if (result.success && result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            const countKey = Object.keys(row).find(k => k.toLowerCase() === "total_count");
            return countKey ? parseInt(row[countKey], 10) : null;
          }
        } catch (e) {
          console.warn("[QueryLab] Count query failed:", e);
        }
        return null;
      })();

      // 2. Fetch page 1 data
      const offset = 0;
      const pageSql = buildPageSql(finalSql, offset, rowsPerPage, currentConfig.type);
      const startTime = performance.now();
      const pageRes = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: currentConfig.type,
          config: wizardData.dbConfig,
          sql: pageSql
        })
      });
      const pageResult = await pageRes.json();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (!pageResult.success) {
        throw new Error(pageResult.message);
      }

      setQueryResults({
        columns: pageResult.columns,
        rows: pageResult.rows,
        executionTime: duration
      });

      // 3. Wait for total count to resolve and update
      const totalCount = await countPromise;
      setTotalRows(totalCount !== null ? totalCount : pageResult.rows.length);

      notifications.show({
        title: "Query Success",
        message: `Returned ${totalCount !== null ? totalCount : pageResult.rows.length} rows.`,
        color: "green",
        icon: <IconBookmark size={16} />
      });
    } catch (err: any) {
      notifications.show({
        title: "Query Failed",
        message: err.message || "An unexpected error occurred.",
        color: "red"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!currentUser?._id || !organization?._id) return;

    const validation = validateSql(sql);
    if (!validation.valid) {
      notifications.show({ title: "Save Blocked", message: validation.message, color: "orange" });
      return;
    }

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

  const handleDeleteQuery = (e: React.MouseEvent, query: any) => {
    e.stopPropagation();
    setQueryToDelete(query);
    setDeleteModalOpen(true);
  };

  const handleRenameQuery = async (e: React.MouseEvent, queryId: any, currentName: string) => {
    e.stopPropagation();
    const newName = prompt("Rename Query:", currentName);
    if (!newName || newName === currentName) return;

    try {
      await renameQueryMutation({ queryId, name: newName });
      notifications.show({
        title: "Query Renamed",
        message: `Successfully renamed to "${newName}"`,
        color: "violet"
      });
    } catch (err: any) {
      notifications.show({ title: "Rename Failed", message: err.message, color: "red" });
    }
  };

  const handleExportCsv = async () => {
    const finalSql = (selectedSql && selectedSql.trim().length > 0) ? selectedSql : sql;
    setIsExporting(true);
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
      if (!result.success) throw new Error(result.message);

      // Create CSV rows
      const headers = result.columns.join(",");
      const rows = result.rows.map((row: any) =>
        result.columns.map((col: string) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
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
      URL.revokeObjectURL(url);
    } catch (err: any) {
      notifications.show({
        title: "Export Failed",
        message: err.message || "An unexpected error occurred during CSV export.",
        color: "red"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Grid styles={{ inner: { gap: "var(--mantine-spacing-xs)" } }}>
      <Grid.Col span={9}>
        <Stack gap="xs">
          <Paper withBorder radius="md" style={{ background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" }}>
            <Group p="xs" justify="space-between" style={{ borderBottom: "1px solid var(--orcha-border)" }}>
              <Group gap="xs">
                <IconTerminal2 size={16} color="#a855f7" />
                <Text size="xs" fw={700} c="var(--orcha-text-title)" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>SQL Editor</Text>
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

          <Paper withBorder radius="md" style={{ background: "var(--orcha-panel)", borderColor: "var(--orcha-border)", flex: 1, minHeight: "400px" }}>
            <Group p="xs" justify="space-between" style={{ borderBottom: "1px solid var(--orcha-border)" }}>
              <Group gap="xs">
                <IconTableExport size={16} color="var(--orcha-text-muted)" />
                <Text size="xs" fw={700} c="dimmed">Query Results</Text>
              </Group>
              <Group gap="xs">
                {queryResults && (
                  <Group gap="md">
                    <Text size="11px" c="dimmed" fw={500}>
                      {totalRows !== null ? `${totalRows} total rows` : "Multiple rows"} returned
                      <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
                      {queryResults.executionTime}ms
                    </Text>
                    <Button
                      variant="light"
                      color="violet"
                      size="compact-xs"
                      leftSection={<IconTableExport size={12} />}
                      onClick={handleExportCsv}
                      loading={isExporting}
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
              <Stack gap="xs">
                <ScrollArea h={400}>
                  <Table variant="simple" verticalSpacing="xs" stickyHeader stickyHeaderOffset={0}>
                    <Table.Thead style={{ zIndex: 1 }}>
                      <Table.Tr style={{ background: "var(--orcha-panel)" }}>
                        {queryResults.columns.map(col => (
                          <Table.Th key={col} style={{ color: "var(--orcha-text-title)", fontSize: "11px", borderColor: "var(--orcha-border)", background: "var(--orcha-panel)" }}>{col}</Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {queryResults.rows.map((row, i) => (
                        <Table.Tr key={i}>
                          {queryResults.columns.map(col => (
                            <Table.Td key={col} style={{ color: "var(--orcha-text-body)", fontSize: "11px", borderColor: "var(--orcha-border)" }}>
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

                {queryResults.rows.length > 0 && (
                  <Group justify="space-between" align="center" mt="xs" px="xs">
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        Showing {startIndex + 1}–{startIndex + queryResults.rows.length} of {totalRows !== null ? totalRows : "many"} rows
                      </Text>
                      <Select
                        size="xs"
                        w={75}
                        value={String(rowsPerPage)}
                        onChange={(val) => {
                          const nextLimit = val ? Number(val) : 100;
                          setRowsPerPage(nextLimit);
                          setCurrentPage(1);
                          if (activeSql) {
                            fetchPage(1, nextLimit, activeSql);
                          }
                        }}
                        data={[
                          { value: "50", label: "50" },
                          { value: "100", label: "100" },
                          { value: "200", label: "200" },
                          { value: "500", label: "500" },
                        ]}
                        styles={{
                          input: {
                            height: "24px",
                            minHeight: "24px",
                            padding: "0 8px",
                            fontSize: "11px",
                            background: "var(--orcha-panel)",
                            borderColor: "var(--orcha-border)",
                            borderRadius: "6px"
                          }
                        }}
                      />
                      <Text size="xs" c="dimmed">per page</Text>
                    </Group>
                    {totalPages > 1 && (
                      <Pagination
                        total={totalPages}
                        value={currentPage}
                        onChange={(newPage) => fetchPage(newPage, rowsPerPage, activeSql)}
                        size="xs"
                        color="violet"
                        withEdges
                      />
                    )}
                  </Group>
                )}
              </Stack>
            ) : (
              <Center h={200}>
                <Stack align="center" gap="xs">
                  <IconSearch size={32} color="var(--orcha-border)" />
                  <Text size="xs" c="dimmed">Run a query to see structured results here.</Text>
                </Stack>
              </Center>
            )}
          </Paper>
        </Stack>
      </Grid.Col>

      <Grid.Col span={3}>
        <Paper withBorder h="100%" radius="md" style={{ background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" }}>
          <Tabs value={activeSidebarTab} onChange={setActiveSidebarTab} color="violet" variant="pills" styles={{
            root: { height: "100%", display: "flex", flexDirection: "column" },
            list: { padding: "12px", borderBottom: "1px solid var(--orcha-border)" },
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

                <ScrollArea h={600} offsetScrollbars viewportRef={containerRef}>
                  <Accordion variant="separated" styles={{
                    item: { border: "1px solid var(--orcha-border)", background: "var(--orcha-surface)", marginBottom: "4px" },
                    control: { padding: "8px 12px" },
                    label: { fontSize: "12px", color: "var(--orcha-text-title)", fontWeight: 600 },
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
                            <Divider label="Columns" labelPosition="center" styles={{ label: { fontSize: '9px', opacity: 0.5 } }} mb={4} />
                            {(model.fields || []).map((f: any) => (
                              <Group key={f.columnName} justify="space-between" wrap="nowrap" style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                background: "var(--orcha-panel)",
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
                    {modelsStatus === "CanLoadMore" && (
                      <Center py="md" ref={sentinelRef}>
                        <Loader size="xs" color="violet" />
                      </Center>
                    )}
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
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.currentTarget.value)}
                />

                <ScrollArea h={600}>
                  <Stack gap="xs">
                    {filteredQueries.length > 0 ? filteredQueries.map((item) => (
                      <Paper key={item._id} p="xs" radius="xs" style={{ background: "rgba(147,51,234,0.03)", cursor: "pointer", border: "1px solid transparent" }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(147,51,234,0.3)"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
                        onClick={() => setSql(item.sql)}
                      >
                        <Group justify="space-between" mb={4} wrap="nowrap">
                          <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={700} c="var(--orcha-text-title)" truncate style={{ flex: 1 }}>{item.name}</Text>
                          </Group>
                          <Group gap={4} style={{ flexShrink: 0 }}>
                            <IconStar size={10} color="#a855f7" />
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="blue"
                              onClick={(e) => handleRenameQuery(e, item._id, item.name)}
                            >
                              <IconEdit size={10} />
                            </ActionIcon>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={(e) => handleDeleteQuery(e, item)}
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

      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setQueryToDelete(null);
        }}
        title="Delete Query"
        centered
        size="sm"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", borderRadius: 12 },
          header: { background: "var(--orcha-panel)", color: "var(--orcha-text-title)" },
          title: { fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="var(--orcha-text-body)">
            Are you sure you want to delete <Text span fw={600} c="var(--orcha-text-title)">"{queryToDelete?.name}"</Text>? This action cannot be undone.
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setDeleteModalOpen(false);
                setQueryToDelete(null);
              }}
              size="xs"
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={async () => {
                if (!queryToDelete) return;
                try {
                  await removeQueryMutation({ queryId: queryToDelete._id });
                  notifications.show({
                    title: "Query Deleted",
                    message: `"${queryToDelete.name}" has been removed from your library.`,
                    color: "violet"
                  });
                } catch (err: any) {
                  const message = typeof err.message === 'string' ? err.message : JSON.stringify(err);
                  notifications.show({ title: "Delete Failed", message, color: "red" });
                } finally {
                  setDeleteModalOpen(false);
                  setQueryToDelete(null);
                }
              }}
              size="xs"
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Grid>
  );
}