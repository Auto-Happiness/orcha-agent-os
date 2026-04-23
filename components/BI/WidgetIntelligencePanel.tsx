"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Tabs,
  Stack,
  Text,
  Button,
  Group,
  TextInput,
  Select,
  Alert,
  Loader,
  Box,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Badge,
  Table,
  ScrollArea,
  Avatar,
  Popover,
  List,
  ThemeIcon,
  Accordion,
  MultiSelect,
  ColorInput,
  Textarea
} from "@mantine/core";
import {
  IconSettings,
  IconSparkles,
  IconInfoCircle,
  IconDatabase,
  IconChartBar,
  IconPlayerPlay,
  IconCheck,
  IconEye,
  IconCode,
  IconAlertCircle,
  IconPalette,
  IconChartPie,
  IconColorPicker
} from "@tabler/icons-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DynamicChart } from "./DynamicChart";

interface WidgetIntelligencePanelProps {
  opened: boolean;
  onClose: () => void;
  widget: any; // The current widget model or template
  mode?: "create" | "edit";
  onSave?: (widgetData: any) => void;
  saas: string;
}

export function WidgetIntelligencePanel({ opened, onClose, widget, mode = "edit", onSave, saas }: WidgetIntelligencePanelProps) {
  // Dynamic States for Mapping
  const user = useQuery(api.users.getCurrentUser);
  const executeQuery = useAction(api.biActions.executeWidgetQuery);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(widget?.configId || null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(widget?.queryId || null);
  const [discoveredColumns, setDiscoveredColumns] = useState<string[]>([]);
  const [labelKey, setLabelKey] = useState(widget?.mapping?.labelKey || "");
  const [valueKeys, setValueKeys] = useState<string[]>(widget?.mapping?.valueKeys || []);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [sqlModalOpened, setSqlModalOpened] = useState(false);

  // Styling States
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(widget?.mapping?.seriesColors || {});
  const [widgetTitle, setWidgetTitle] = useState(widget?.title || "");
  const [textContent, setTextContent] = useState(widget?.description || "");
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when panel opens/closes
  useEffect(() => {
    if (opened) {
      setSelectedConfigId(widget?.configId || null);
      setSelectedQueryId(widget?.queryId || null);
      setLabelKey(widget?.mapping?.labelKey || "");
      setValueKeys(widget?.mapping?.valueKeys || []);
      setSeriesColors(widget?.mapping?.seriesColors || {});
      setWidgetTitle(widget?.title || "");
      setTextContent(widget?.description || "");
      setIsSaving(false);
    } else {
      // Clear specific transient states on close
      setDiscoveredColumns([]);
      setIsExecuting(false);
      setExecutionError(null);
      setPreviewRows([]);
      setSqlModalOpened(false);
    }
  }, [opened, widget]);

  // Sync series colors when valueKeys change
  useEffect(() => {
    const newSeriesColors = { ...seriesColors };
    let changed = false;

    valueKeys.forEach((key, index) => {
      if (!newSeriesColors[key]) {
        // Auto-assign from a default attractive palette
        const defaultPalette = ["#9333ea", "#00D1FF", "#00FF94", "#FF00E5", "#FFB800", "#FF6B6B"];
        newSeriesColors[key] = defaultPalette[index % defaultPalette.length];
        changed = true;
      }
    });

    if (changed) {
      setSeriesColors(newSeriesColors);
    }
  }, [valueKeys]);

  // Mutants & Queries
  const organization = useQuery(api.organizations.getSafeBySlug, { slug: saas });
  const configs = useQuery(api.databaseConfigs.listByOrganization, organization ? { organizationId: organization._id } : "skip");
  const savedQueries = useQuery(api.savedQueries.listByConfig, selectedConfigId ? { configId: selectedConfigId as any } : "skip");

  const handleExecute = async () => {
    const config = configs?.find(c => c._id === selectedConfigId);
    const query = savedQueries?.find(q => q._id === selectedQueryId);
    if (!config || !query) return;

    setIsExecuting(true);
    setExecutionError(null);
    try {
      const dbConfig = JSON.parse(config.encryptedUri);

      let innerSql = query.sql.trim().replace(/;?\s*$/, "");
      const isMssql = config.type === "mssql";
      let limitedSql = "";

      if (isMssql) {
        if (/ORDER\s+BY/i.test(innerSql) && !/TOP\s+\d+/i.test(innerSql)) {
          innerSql = innerSql.replace(/(\bSELECT\b(\s+DISTINCT)?)/i, "$1 TOP 100 PERCENT ");
        }
        limitedSql = `SELECT TOP 10 * FROM (${innerSql}) AS _orcha_preview`;
      } else {
        limitedSql = `SELECT * FROM (${innerSql}) AS _orcha_preview LIMIT 10`;
      }

      console.log(`[BI Discovery] Executing with Best-Practice Safeguard: ${limitedSql}`);

      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: config.type,
          config: dbConfig,
          sql: limitedSql,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Query failed");

      const cols = data.columns || (data.rows[0] ? Object.keys(data.rows[0]) : []);
      setDiscoveredColumns(cols);
      setPreviewRows(data.rows || []);
    } catch (err: any) {
      setExecutionError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const getSmartValidationLogs = () => {
    const query = savedQueries?.find(q => q._id === selectedQueryId);
    if (!query) return [];

    const logs: { type: 'success' | 'warning' | 'info'; message: string; id: string }[] = [];
    const sql = query.sql.toUpperCase();

    // Aggregation Checks
    const hasGroupBy = sql.includes("GROUP BY");
    const hasAggregation = /COUNT\s*\(|SUM\s*\(|AVG\s*\(|MIN\s*\(|MAX\s*\(/.test(sql);

    if (hasGroupBy) logs.push({ id: 'group-by', type: 'success', message: "Group By detected - Perfect for categorical charts." });
    if (hasAggregation) logs.push({ id: 'agg', type: 'success', message: "Aggregations found - Data is summarized." });
    if (!hasGroupBy && !hasAggregation) {
      logs.push({ id: 'raw', type: 'info', message: "Raw data detected. Charts usually require GROUP BY for better visuals." });
    }

    // Filter Checks
    if (sql.includes("WHERE")) {
      logs.push({ id: 'where', type: 'success', message: "Query limited by WHERE filters." });
    } else {
      logs.push({ id: 'no-where', type: 'info', message: "No WHERE clause - extracting full dataset scope." });
    }

    // Cardinality / Execution Checks
    const rowCount = previewRows.length;
    if (rowCount > 0) {
      if (rowCount > 20) {
        logs.push({ id: 'high-card', type: 'warning', message: `High Cardinality: ${rowCount} rows found. Visuals might be cluttered.` });
      } else {
        logs.push({ id: 'low-card', type: 'success', message: `Optimized Density: ${rowCount} rows is ideal for charting.` });
      }
    }

    // Chart-Specific Logic
    if (widget?.type === 'line') {
      const hasTime = /(DATE|TIME|CREATED|TS|YEAR|MONTH|DAY)/.test(sql);
      if (!hasTime) {
        logs.push({ id: 'time-warn', type: 'warning', message: "Line charts usually require a time-based X-Axis column." });
      }
    }

    return logs;
  };

  const validationLogs = getSmartValidationLogs();
  const isTextWidget = widget?.type === "text";

  if (isTextWidget) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs">
            <IconChartBar size={20} color="var(--mantine-color-violet-filled)" />
            <Text fw={700}>Text Box: {widget?.title || "New Text Box"}</Text>
          </Group>
        }
        size="lg"
        radius="lg"
        styles={{
          content: {
            background: "#0c0a1d",
            border: "1px solid rgba(147, 51, 234, 0.2)",
            backdropFilter: "blur(24px)",
            color: "white"
          },
          header: { background: "transparent" },
          close: { color: "gray" }
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Component Title"
            placeholder="e.g. Executive Notes"
            value={widgetTitle}
            onChange={(e) => setWidgetTitle(e.currentTarget.value)}
          />
          <Textarea
            label="Text Content"
            placeholder="Add explanatory notes, business context, assumptions, and guidance..."
            minRows={8}
            autosize
            value={textContent}
            onChange={(e) => setTextContent(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
            <Button
              color="violet"
              loading={isSaving}
              onClick={async () => {
                if (onSave) {
                  setIsSaving(true);
                  try {
                    await onSave({
                      ...widget,
                      title: widgetTitle || "Text Box",
                      description: textContent,
                      queryId: undefined,
                      mapping: undefined,
                      status: "configured",
                    });
                    onClose();
                  } catch (err) {
                    console.error("Save failed:", err);
                  } finally {
                    setIsSaving(false);
                  }
                }
              }}
            >
              {mode === "create" ? "Add to Dashboard" : "Apply Settings"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }


  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconChartBar size={20} color="var(--mantine-color-violet-filled)" />
          <Text fw={700}>Intelligence Panel: {widget?.title || "Configure Widget"}</Text>
        </Group>
      }
      size="90%"
      radius="lg"
      styles={{
        content: {
          background: "#0c0a1d",
          border: "1px solid rgba(147, 51, 234, 0.2)",
          backdropFilter: "blur(24px)",
          minHeight: '80vh',
          color: "white"
        },
        header: {
          background: "transparent",
        },
        close: {
          color: "gray"
        }
      }}
    >
      <Stack gap="xl">
        <Stack gap="lg">
          <Box>
            <Group grow align="flex-start" gap="md">
              <Box>
                <Group mb="xs">
                  <IconDatabase size={16} color="gray" />
                  <Text size="sm" fw={600} c="dimmed">1. ENVIRONMENT</Text>
                </Group>
                <Select
                  placeholder="Select source..."
                  data={configs?.map(c => ({ value: c._id, label: c.name })) || []}
                  value={selectedConfigId}
                  onChange={setSelectedConfigId}
                  size="md"
                  leftSection={
                    configs?.find(c => c._id === selectedConfigId)?.type === "mysql" ? (
                      <IconDatabase size={16} color="blue" />
                    ) : configs?.find(c => c._id === selectedConfigId)?.type === "mssql" ? (
                      <IconDatabase size={16} color="red" />
                    ) : (
                      <IconDatabase size={16} color="gray" />
                    )
                  }
                />
              </Box>
              <Box>
                <Group mb="xs">
                  <IconDatabase size={16} color="gray" />
                  <Text size="sm" fw={600} c="dimmed">2. SAVED QUERY</Text>
                </Group>
                <Group align="flex-end" gap="xs">
                  <Select
                    placeholder={selectedConfigId ? "Choose a query..." : "Select environment first"}
                    data={savedQueries?.map(q => ({ value: q._id, label: q.name })) || []}
                    value={selectedQueryId}
                    onChange={setSelectedQueryId}
                    disabled={!selectedConfigId}
                    searchable
                    size="md"
                    style={{ flex: 1 }}
                  />
                  <ActionIcon
                    variant="light"
                    color="violet"
                    size="42px"
                    disabled={!selectedQueryId}
                    onClick={() => setSqlModalOpened(true)}
                  >
                    <IconCode size={20} />
                  </ActionIcon>
                </Group>
              </Box>
            </Group>

            <Modal
              opened={sqlModalOpened}
              onClose={() => setSqlModalOpened(false)}
              title="Saved Query SQL Source"
              size="lg"
              withinPortal
              styles={{
                content: { background: "#1a1635", border: "1px solid rgba(147, 51, 234, 0.2)" },
                header: { background: "transparent" }
              }}
            >
              <Paper p="md" bg="rgba(0,0,0,0.3)" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                <pre style={{ margin: 0, color: "var(--mantine-color-cyan-4)", fontSize: "14px", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                  {savedQueries?.find(q => q._id === selectedQueryId)?.sql || "-- No SQL found --"}
                </pre>
              </Paper>
            </Modal>

            {selectedQueryId && (
              <Box mt="xl">
                <Group justify="space-between" align="center" mb="xs">
                  <Text size="xs" fw={700} c="dimmed">3. DATA DISCOVERY</Text>
                  <Popover width={480} position="bottom-end" withArrow shadow="md" radius="md">
                    <Popover.Target>
                      <Button variant="subtle" color={validationLogs.some(l => l.type === 'warning') ? "orange" : "cyan"} size="compact-xs" leftSection={<IconSparkles size={14} />}>
                        Smart Advisor {validationLogs.length > 0 && `(${validationLogs.length})`}
                      </Button>
                    </Popover.Target>
                    <Popover.Dropdown bg="#130f22" style={{ border: "1px solid rgba(147, 51, 234, 0.2)" }}>
                      <Stack gap="md">
                        <Text size="sm" fw={700} c="dimmed" mb={4}>DIAGNOSTIC LOGS</Text>
                        {validationLogs.length === 0 ? (
                          <Text size="sm" c="dimmed">No analysis available yet.</Text>
                        ) : (
                          <List spacing="md" size="sm">
                            {validationLogs.map(log => (
                              <List.Item key={log.id} icon={<ThemeIcon color={log.type === 'success' ? 'green' : log.type === 'warning' ? 'orange' : 'blue'} size={24} radius="xl">{log.type === 'success' ? <IconCheck size={14} /> : log.type === 'warning' ? <IconAlertCircle size={14} /> : <IconInfoCircle size={14} />}</ThemeIcon>}>
                                <Text size="sm" c={log.type === 'warning' ? 'orange.4' : 'gray.4'} ml={4}>{log.message}</Text>
                              </List.Item>
                            ))}
                          </List>
                        )}
                      </Stack>
                    </Popover.Dropdown>
                  </Popover>
                </Group>

                <Button variant="light" color="violet" fullWidth onClick={handleExecute} loading={isExecuting} leftSection={<IconPlayerPlay size={16} />}>
                  Execute & Discover Schema
                </Button>

                {executionError && <Alert color="red" mt="sm">{executionError}</Alert>}

                {discoveredColumns.length > 0 && (
                  <Stack gap="md" mt="md">
                    <Box p="xs" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                      <Text size="xs" fw={700} mb="xs" c="cyan">DISCOVERED SCHEMA</Text>
                      <Group gap={4}>
                        {discoveredColumns.map(col => <Badge key={col} variant="dot" color="cyan" size="sm">{col}</Badge>)}
                      </Group>
                    </Box>
                    <Box>
                      <Text size="xs" fw={700} mb={8} c="dimmed">DATA PREVIEW (FIRST 10 ROWS)</Text>
                      <Paper p={0} radius="md" withBorder style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <ScrollArea h={200}>
                          <Table highlightOnHover withColumnBorders verticalSpacing="xs">
                            <Table.Thead style={{ background: 'rgba(147, 51, 234, 0.05)' }}>
                              <Table.Tr>
                                {discoveredColumns.map(col => <Table.Th key={col} style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{col}</Table.Th>)}
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {previewRows.slice(0, 10).map((row, i) => (
                                <Table.Tr key={i}>
                                  {discoveredColumns.map(col => <Table.Td key={col} style={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.05)' }}>{row[col]}</Table.Td>)}
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </ScrollArea>
                      </Paper>
                    </Box>
                  </Stack>
                )}
              </Box>
            )}

            <Box mt="xl">
              <Group gap="xs" mb="xs">
                <IconSettings size={16} color="gray" />
                <Text size="sm" fw={600} c="dimmed">4. COLUMN MAPPING</Text>
              </Group>
              <Stack gap="sm">
                <Group grow>
                  <Select label="Label Column (X-Axis)" data={discoveredColumns} value={labelKey} onChange={(v) => setLabelKey(v || "")} disabled={discoveredColumns.length === 0} />
                  <MultiSelect label="Value Columns (Y-Axis)" data={discoveredColumns} value={valueKeys} onChange={setValueKeys} disabled={discoveredColumns.length === 0} />
                </Group>
              </Stack>
            </Box>

            <Box mt="md">
              <Group gap="xs" mb="xs">
                <IconPalette size={16} color="gray" />
                <Text size="sm" fw={600} c="dimmed">5. LOOK & FEEL</Text>
              </Group>
              <Paper p="md" radius="md" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {valueKeys.length > 0 ? (
                  <Stack gap={8}>
                    {valueKeys.map((key) => (
                      <Group key={key} justify="space-between">
                        <Text size="xs" c="dimmed">{key}</Text>
                        <ColorInput size="xs" w={120} value={seriesColors[key] || "#9333ea"} onChange={(color) => setSeriesColors(prev => ({ ...prev, [key]: color }))} />
                      </Group>
                    ))}
                  </Stack>
                ) : <Text size="xs" c="dimmed" ta="center">Select value columns to configure colors</Text>}
              </Paper>
            </Box>

            <Box mt="md">
              <Group gap="xs" mb="xs">
                <IconChartPie size={16} color="gray" />
                <Text size="sm" fw={600} c="dimmed">6. LIVE PREVIEW</Text>
              </Group>
              <Paper p="md" radius="md" h={280} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(147, 51, 234, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {labelKey && valueKeys.length > 0 ? (
                  <DynamicChart data={previewRows} type={widget?.type || "bar"} labelKey={labelKey} valueKeys={valueKeys} height={240} seriesColors={seriesColors} />
                ) : <Text size="xs" c="dimmed">Select mapping keys to generate preview</Text>}
              </Paper>
            </Box>

            <Group justify="flex-end" mt="xl">
              <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
              <Button 
                color="violet" 
                loading={isSaving}
                onClick={async () => { 
                  if (onSave) {
                    setIsSaving(true);
                    try {
                      await onSave({ 
                        ...widget, 
                        title: widgetTitle || widget?.title, 
                        description: textContent, 
                        queryId: selectedQueryId, 
                        mapping: { labelKey, valueKeys, seriesColors }, 
                        status: 'configured' 
                      }); 
                      onClose();
                    } catch (err) {
                      console.error("Save failed:", err);
                    } finally {
                      setIsSaving(false);
                    }
                  } 
                }}
              >
                {mode === "create" ? "Add to Dashboard" : "Apply Settings"}
              </Button>
            </Group>
          </Box>
        </Stack>
      </Stack>
    </Modal>
  );
}

function getAdviceForType(type?: string) {
  switch (type) {
    case 'bar':
      return "Bar charts work best for comparing categories. Select one categorical column (String) and one numeric value.";
    case 'line':
      return "Line charts are ideal for trends over time. Please select a Date/Time column for the X-Axis.";
    case 'pie':
      return "Pie charts show proportions. Best with 2-5 distinct categories to keep the visual clean.";
    case 'kpi':
      return "KPIs show single high-impact numbers. Map a singular 'Value' column.";
    default:
      return "Select a data source to begin mapping columns to your visual.";
  }
}
