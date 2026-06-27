"use client";

import {
  Stack,
  Group,
  Text,
  Box,
  Card,
  Badge,
  ScrollArea,
  rem,
  Paper,
  ActionIcon,
  TextInput,
  Select,
  Grid,
  Button,
  Divider,
  Title,
  Center,
  Tooltip,
  Tabs,
  SegmentedControl,
  Loader,
  Textarea,
  Modal,
  Menu
} from "@mantine/core";
import {
  IconTable,
  IconPlus,
  IconFingerprint,
  IconSettings,
  IconChartDots,
  IconActivity,
  IconDatabaseImport,
  IconUpload,
  IconCheck,
  IconDownload,
  IconDotsVertical
} from "@tabler/icons-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction, usePaginatedQuery } from "convex/react";
import { useIntersection } from "@mantine/hooks";
import { api } from "@/convex/_generated/api";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { notifications } from "@mantine/notifications";
import { useParams } from "next/navigation";
import { SchemaDiagram } from "./SchemaDiagram";

interface SemanticBridgeProps {
  configId: string | null;
  organizationId?: string | null;
}

export function SemanticBridge({ configId }: SemanticBridgeProps) {
  const { saas } = useParams();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const { results: modelsSummaries, status: modelsStatus, loadMore: loadMoreModels } = usePaginatedQuery(
    api.semanticModels.listModelSummariesByConfig, 
    { configId: configId as any },
    { initialNumItems: 50 }
  );
  
  const [sidebarSearch, setSidebarSearch] = useState("");
  const relationships = useQuery(api.semanticRelationships.listByConfig, { configId: configId as any });
  const { data, updateData } = useCreationWizard();

  const [viewMode, setViewMode] = useState<string>("list");

  // dbt Importer State
  const [dbtModalOpen, setDbtModalOpen] = useState(false);
  const [manifestFileName, setManifestFileName] = useState<string>("");
  const [catalogFileName, setCatalogFileName] = useState<string>("");
  const [manifestJson, setManifestJson] = useState<any>(null);
  const [catalogJson, setCatalogJson] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedStats, setParsedStats] = useState<{ modelsCount: number; relationshipsCount: number } | null>(null);

  const manifestInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  // Infinite Scroll Sentinel
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

  // Only show models that were selected in the previous step
  // If in edit mode (data.selectedTables is empty), show all models for this config
  const models: any[] = useMemo(() => {
    if (!modelsSummaries) return [];
    if (!data.selectedTables || data.selectedTables.length === 0) return modelsSummaries;
    return modelsSummaries.filter((m: any) => data.selectedTables?.includes(m.tableName));
  }, [modelsSummaries, data.selectedTables]);

  const updateModel = useMutation(api.semanticModels.updateModel);
  const suggestRelationships = useAction(api.semanticModels.suggestRelationships);
  const aiEnrich = useAction(api.semanticModels.generateAiEnrichment);
  const [isEnriching, setIsEnriching] = useState(false);

  // Suggest relationships when the step is first reached
  useMemo(() => {
    if (configId && activeOrg?._id) {
      suggestRelationships({
        configId: configId as any,
        organizationId: activeOrg._id
      }).then(res => {
        if (res.suggestions && res.suggestions.length > 0) {
          notifications.show({
            title: "Relationships Suggested",
            message: `Automatically identified ${res.suggestions.length} potential table links.`,
            color: "violet",
            icon: <IconSettings size={16} />
          });
        }
      });
    }
  }, [configId, activeOrg?._id, suggestRelationships]);

  const handleAiEnrich = async () => {
    if (!configId || !activeOrg?._id) return;
    setIsEnriching(true);
    try {
      await aiEnrich({
        configId: configId as any,
        businessContext: data.businessContext || ""
      });
      notifications.show({ title: "AI Modeling Complete", message: "Refined business names and types using AI insights.", color: "green" });
    } catch (err) {
      notifications.show({ title: "AI Failed", message: "Could not apply AI enrichment.", color: "red" });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleManifestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setManifestFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.nodes) {
          notifications.show({
            title: "Invalid File",
            message: "This does not look like a valid dbt manifest.json (missing 'nodes' key).",
            color: "red",
          });
          return;
        }
        setManifestJson(json);
        
        let modelsCount = 0;
        let relationshipsCount = 0;
        
        const nodes = json.nodes || {};
        const sources = json.sources || {};
        const allNodes = { ...nodes, ...sources };
        
        for (const node of Object.values(allNodes) as any[]) {
          if (node.resource_type === "model" || node.resource_type === "source") {
            modelsCount++;
          }
          if (node.resource_type === "test" && node.test_metadata?.name === "relationships") {
            relationshipsCount++;
          }
        }
        
        setParsedStats({ modelsCount, relationshipsCount });
      } catch (err: any) {
        notifications.show({
          title: "Parse Error",
          message: "Failed to parse manifest.json. Ensure it is valid JSON.",
          color: "red",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleCatalogFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCatalogFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setCatalogJson(json);
        notifications.show({
          title: "Catalog Loaded",
          message: `Successfully loaded dbt catalog: ${file.name}`,
          color: "green",
        });
      } catch (err: any) {
        notifications.show({
          title: "Parse Error",
          message: "Failed to parse catalog.json. Ensure it is valid JSON.",
          color: "red",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDbtImport = async () => {
    if (!manifestJson || !configId || !activeOrg?._id) return;
    setIsImporting(true);
    try {
      const response = await fetch("/api/db/import-dbt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrg._id,
          configId,
          manifest: manifestJson,
          catalog: catalogJson,
        }),
      });
      const res = await response.json();
      if (res.success) {
        notifications.show({
          title: "Import Successful",
          message: `Successfully imported ${res.modelsCount} models and created ${res.relationshipsCreated} relationships from dbt.`,
          color: "green",
        });
        setDbtModalOpen(false);
        setManifestFileName("");
        setCatalogFileName("");
        setManifestJson(null);
        setCatalogJson(null);
        setParsedStats(null);
        window.location.reload();
      } else {
        notifications.show({
          title: "Import Failed",
          message: res.message || "Failed to import dbt project.",
          color: "red",
        });
      }
    } catch (err: any) {
      notifications.show({
        title: "Network Error",
        message: err.message || "Could not connect to import service.",
        color: "red",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const [activeTable, setActiveTable] = useState<string | null>(null);

  // Initialize active table if not set
  useMemo(() => {
    if (!activeTable && models.length > 0) {
      setActiveTable(models[0].tableName);
    }
  }, [models, activeTable]);

  // Sidebar logic (Search & Infinite Scroll)
  const filteredModels = (modelsSummaries || []).filter(m =>
    m.tableName.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    m.displayName.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  // Fetch FULL details for the active table only
  const activeModel = useQuery(api.semanticModels.getModelDetails,
    activeTable ? { configId: configId as any, tableName: activeTable } : "skip"
  );

  const selectedModel = activeModel;

  const handleFieldUpdate = async (fieldIdx: number, updates: any) => {
    if (!selectedModel) return;

    const newFields = [...selectedModel.fields];
    newFields[fieldIdx] = { ...newFields[fieldIdx], ...updates };

    try {
      await updateModel({
        id: selectedModel._id,
        fields: newFields,
      });
    } catch (err) {
      notifications.show({ title: "Update Failed", message: "Could not save field changes.", color: "red" });
    }
  };

  if (modelsSummaries === undefined) {
    return <Text c="dimmed">Loading models...</Text>;
  }

  return (
    <Stack gap="xl">
      <Group justify="flex-end">
        <SegmentedControl
          value={viewMode}
          onChange={setViewMode}
          data={[
            { label: 'Form View', value: 'list' },
            { label: 'Diagram View', value: 'diagram' },
          ]}
          color="violet"
          size="xs"
        />
      </Group>

      {viewMode === 'diagram' ? (
        <SchemaDiagram models={models} relationships={relationships || []} />
      ) : (
        <Grid>

          {/* Sidebar: Selected Tables */}
          <Grid.Col span={3}>
            <Stack gap="md">
              <Card withBorder radius="md" p="sm" style={{ background: "var(--orcha-surface)" }}>
                <Stack gap={8}>
                  <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: rem(1) }}>Business Context</Text>
                  <Text size="10px" c="dimmed">Help the AI understand this DB (e.g. "SaaS Billing")</Text>
                  <TextInput
                    placeholder="Database purpose..."
                    size="xs"
                    value={data.businessContext}
                    onChange={(e) => updateData({ businessContext: e.currentTarget.value })}
                    styles={{ input: { background: "var(--orcha-panel)" } }}
                  />
                </Stack>
              </Card>

              <Box>
                <Text size="xs" fw={700} c="dimmed" px="xs" mb={8} style={{ textTransform: "uppercase", letterSpacing: rem(1) }}>Selected Models</Text>
                <ScrollArea h={500} offsetScrollbars viewportRef={containerRef}>
                  <Stack gap="xs" pr="xs">
                    {models.map(m => (
                      <Paper
                        key={m._id}
                        p="sm"
                        radius="md"
                        style={{
                          cursor: "pointer",
                          background: activeTable === m.tableName ? "rgba(147,51,234,0.15)" : "transparent",
                          border: "1px solid",
                          borderColor: activeTable === m.tableName ? "rgba(147,51,234,0.3)" : "transparent",
                          transition: "all 150ms ease"
                        }}
                        onClick={() => setActiveTable(m.tableName)}
                      >
                        <Group gap="sm" wrap="nowrap">
                          <IconTable size={16} color={activeTable === m.tableName ? "#a855f7" : "var(--orcha-text-muted)"} />
                          <Box style={{ flex: 1 }}>
                            <Text size="sm" fw={600} c={activeTable === m.tableName ? "var(--orcha-text-title)" : "dimmed"}>{m.displayName}</Text>
                            <Text size="10px" c="dimmed">{m.fieldCount} fields</Text>
                          </Box>
                        </Group>
                      </Paper>
                    ))}

                    {/* Infinite Scroll Sentinel */}
                    {modelsStatus === "CanLoadMore" && (
                      <Center py="md" ref={sentinelRef}>
                        <Loader size="xs" color="violet" />
                      </Center>
                    )}
                  </Stack>
                </ScrollArea>
              </Box>


            </Stack>
          </Grid.Col>

          {/* Main Content: Field Editor */}
          <Grid.Col span={9}>
            {selectedModel ? (
              <Stack gap="xl">
                <Box>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <TextInput
                        size="sm"
                        placeholder="Table Display Name"
                        defaultValue={selectedModel.displayName}
                        onBlur={(e) => updateModel({ id: selectedModel._id, displayName: e.currentTarget.value })}
                        styles={{ input: { background: "transparent", border: "none", padding: 0, fontWeight: 700, fontSize: rem(20), color: "var(--orcha-text-title)" } }}
                      />
                      <Text size="xs" c="dimmed">Source: <span style={{ fontFamily: "monospace" }}>{selectedModel.tableName}</span></Text>
                    </Stack>
                    <Group>
                      <Menu shadow="md" width={220} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="lg" radius="md">
                            <IconDotsVertical size={18} />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <Menu.Label>Semantic Modeling Actions</Menu.Label>
                          <Menu.Item
                            leftSection={<IconDatabaseImport size={14} color="#a855f7" />}
                            onClick={() => setDbtModalOpen(true)}
                          >
                            Import dbt metadata
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconDownload size={14} color="#a855f7" />}
                            component="a"
                            href={`/api/db/export-osi?configId=${configId}&organizationId=${activeOrg?._id}`}
                            download
                          >
                            Export OSI Model
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconDownload size={14} color="#a855f7" />}
                            component="a"
                            href={`/api/db/export-dbt?configId=${configId}&organizationId=${activeOrg?._id}`}
                            download
                          >
                            Export dbt Schema
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Label>AI & Settings</Menu.Label>
                          <Menu.Item
                            leftSection={<IconSettings size={14} color="#3b82f6" />}
                            onClick={handleAiEnrich}
                            disabled={isEnriching}
                          >
                            {isEnriching ? "Enriching..." : "AI Magic Enrichment"}
                          </Menu.Item>
                          <Menu.Item leftSection={<IconSettings size={14} color="#6b7280" />}>
                            Manual Settings
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </Box>

                <Grid grow>
                  <Grid.Col span={6}>
                    <Textarea
                      label="Business Description"
                      placeholder="What is this table used for?"
                      defaultValue={selectedModel.description}
                      onBlur={(e) => updateModel({ id: selectedModel._id, description: e.currentTarget.value })}
                      minRows={2}
                      maxLength={30}
                      styles={{ input: { background: "rgba(255,255,255,0.02)" } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Textarea
                      label="Business Logic / Caveats"
                      placeholder="e.g. 'Only includes data since 2021'"
                      defaultValue={selectedModel.remarks}
                      onBlur={(e) => updateModel({ id: selectedModel._id, remarks: e.currentTarget.value })}
                      minRows={2}
                      maxLength={30}
                      styles={{ input: { background: "rgba(255,255,255,0.02)" } }}
                    />
                  </Grid.Col>
                </Grid>

                <Divider label="Field Definitions" labelPosition="center" />

                <ScrollArea h={600} pr="md">
                  <Stack gap="md">
                    {!selectedModel || !selectedModel.fields ? (
                      <Center py="3rem"><Loader color="violet" size="sm" type="dots" /></Center>
                    ) : (
                      selectedModel.fields.map((field: any, idx: number) => (
                        <Card key={field.columnName} withBorder style={{
                           background: "var(--orcha-surface)",
                           borderColor: field.isPrimary ? "rgba(147,51,234,0.4)" : "var(--orcha-border)",
                          boxShadow: field.isPrimary ? "0 0 10px rgba(147,51,234,0.1)" : "none"
                        }} radius="md" p="sm">
                          <Grid align="center">
                            <Grid.Col span={3}>
                              <Stack gap={4}>
                                <TextInput
                                  size="xs"
                                  label="Business Name"
                                  defaultValue={field.displayName}
                                  onBlur={(e) => handleFieldUpdate(idx, { displayName: e.currentTarget.value })}
                                   styles={{ input: { background: "transparent", border: "none", padding: 0, fontWeight: 700, fontSize: rem(14) }, label: { fontSize: rem(10), color: "var(--orcha-text-muted)" } }}
                                />
                                <Group gap={4}>
                                  <Text size="10px" c="dimmed" ff="monospace">{field.columnName}</Text>
                                  {field.isPrimary && <Badge size="9px" variant="filled" color="violet">PK</Badge>}
                                </Group>
                              </Stack>
                            </Grid.Col>

                            <Grid.Col span={2}>
                              <Select
                                size="xs"
                                label="Semantic Type"
                                data={[
                                  { value: 'dimension', label: 'Dimension' },
                                  { value: 'measure', label: 'Measure' },
                                ]}
                                value={field.fieldType || (field.type === 'measure' ? 'measure' : 'dimension')}
                                onChange={(val) => handleFieldUpdate(idx, { fieldType: val!, defaultAggregation: val === 'measure' ? 'sum' : undefined })}
                                styles={{ input: { background: "var(--orcha-panel)", height: rem(32) } }}
                              />
                            </Grid.Col>

                            <Grid.Col span={2}>
                              { (field.fieldType === 'measure' || field.type === 'measure') ? (
                                <Select
                                  size="xs"
                                  label="Default Agg"
                                  data={[
                                    { value: 'sum', label: 'Sum' },
                                    { value: 'avg', label: 'Average' },
                                    { value: 'count', label: 'Count' },
                                    { value: 'max', label: 'Max' },
                                    { value: 'min', label: 'Min' },
                                  ]}
                                  value={field.defaultAggregation || field.aggregation || 'sum'}
                                  onChange={(val) => handleFieldUpdate(idx, { defaultAggregation: val! })}
                                  styles={{ input: { background: "var(--orcha-panel)", height: rem(32) }, label: { fontSize: rem(10), color: "var(--orcha-text-muted)" } }}
                                />
                              ) : (
                                <TextInput
                                  size="xs"
                                  label="Data Type"
                                  placeholder="e.g. currency"
                                  defaultValue={field.dataType}
                                  onBlur={(e) => handleFieldUpdate(idx, { dataType: e.currentTarget.value })}
                                  styles={{ input: { background: "var(--orcha-panel)", height: rem(32) }, label: { fontSize: rem(10), color: "var(--orcha-text-muted)" } }}
                                />
                              )}
                            </Grid.Col>

                            <Grid.Col span={4}>
                              <Stack gap={4}>
                                <TextInput
                                  size="xs"
                                  label="Business Description"
                                  placeholder="What is this column?"
                                  defaultValue={field.description}
                                  onBlur={(e) => handleFieldUpdate(idx, { description: e.currentTarget.value })}
                                  styles={{ input: { background: "var(--orcha-panel)", height: rem(32) }, label: { fontSize: rem(10), color: "var(--orcha-text-muted)" } }}
                                />
                                <TextInput
                                  size="xs"
                                  label="Logic / Remarks"
                                  placeholder="Notes for AI..."
                                  defaultValue={field.remarks}
                                  onBlur={(e) => handleFieldUpdate(idx, { remarks: e.currentTarget.value })}
                                  styles={{ input: { background: "var(--orcha-panel)", height: rem(32) }, label: { fontSize: rem(10), color: "var(--orcha-text-muted)" } }}
                                />
                              </Stack>
                            </Grid.Col>

                            <Grid.Col span={1} ta="right">
                              <Group gap={4} justify="flex-end">
                                <Tooltip label={field.isTimeDimension ? "Time Series Active" : "Mark as Time Series"}>
                                  <ActionIcon
                                    variant={field.isTimeDimension ? "filled" : "subtle"}
                                    color="cyan"
                                    size="sm"
                                    onClick={() => handleFieldUpdate(idx, { isTimeDimension: !field.isTimeDimension })}
                                  >
                                    <IconActivity size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label={field.isPrimary ? "Primary Key" : "Mark as PK"}>
                                  <ActionIcon
                                    variant={field.isPrimary ? "filled" : "subtle"}
                                    color="violet"
                                    size="sm"
                                    onClick={() => handleFieldUpdate(idx, { isPrimary: !field.isPrimary })}
                                  >
                                    <IconFingerprint size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Grid.Col>
                          </Grid>
                        </Card>
                      ))
                    )}
                  </Stack>
                </ScrollArea>
              </Stack>
            ) : (
              <Center h={400}>
                <Text c="dimmed">Select a table to start modeling.</Text>
              </Center>
            )}
          </Grid.Col>
        </Grid>
      )}

      {/* Modal: Import dbt Project Metadata */}
      <Modal
        opened={dbtModalOpen}
        onClose={() => {
          if (!isImporting) setDbtModalOpen(false);
        }}
        title="Import dbt Project Metadata"
        centered
        radius="md"
        size="lg"
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
          header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)" },
          title: { color: "var(--orcha-text-title)", fontWeight: 700 }
        }}
      >
        <Stack gap="md" pt="xs">
          <Text size="xs" c="dimmed">
            Enrich your Orcha OS semantic models with column descriptions, layer documentation, primary keys, and relationships exported from your dbt project.
          </Text>

          <Paper withBorder p="md" radius="md" style={{ background: "var(--orcha-surface)", borderStyle: "dashed" }}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Box style={{ flex: 1 }}>
                  <Text size="xs" fw={700} c="var(--orcha-text-title)">dbt Manifest File (manifest.json)</Text>
                  <Text size="10px" c="dimmed">Contains model descriptions, tests, and dependencies.</Text>
                </Box>
                <Button
                  variant="light"
                  color="violet"
                  size="xs"
                  onClick={() => manifestInputRef.current?.click()}
                  leftSection={<IconUpload size={14} />}
                >
                  {manifestFileName ? "Change File" : "Select File"}
                </Button>
                <input
                  ref={manifestInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={handleManifestFileChange}
                />
              </Group>
              {manifestFileName && (
                <Group gap={6}>
                  <IconCheck size={14} color="#22c55e" />
                  <Text size="xs" c="green.4" fw={500}>{manifestFileName}</Text>
                </Group>
              )}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md" style={{ background: "var(--orcha-surface)", borderStyle: "dashed" }}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Box style={{ flex: 1 }}>
                  <Text size="xs" fw={700} c="var(--orcha-text-title)">dbt Catalog File (catalog.json) — Optional</Text>
                  <Text size="10px" c="dimmed">Contains verified database column types from your warehouse.</Text>
                </Box>
                <Button
                  variant="light"
                  color="violet"
                  size="xs"
                  onClick={() => catalogInputRef.current?.click()}
                  leftSection={<IconUpload size={14} />}
                >
                  {catalogFileName ? "Change File" : "Select File"}
                </Button>
                <input
                  ref={catalogInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={handleCatalogFileChange}
                />
              </Group>
              {catalogFileName && (
                <Group gap={6}>
                  <IconCheck size={14} color="#22c55e" />
                  <Text size="xs" c="green.4" fw={500}>{catalogFileName}</Text>
                </Group>
              )}
            </Stack>
          </Paper>

          {parsedStats && (
            <Paper p="sm" radius="md" style={{ background: "rgba(147, 51, 234, 0.05)", border: "1px solid rgba(147, 51, 234, 0.15)" }}>
              <Stack gap={6}>
                <Text size="xs" fw={700} c="violet.2">Preview dbt Metadata:</Text>
                <Group gap="xl">
                  <Text size="xs" c="var(--orcha-text-body)">📁 Models found: <span style={{ fontWeight: 700, color: "var(--orcha-purple)" }}>{parsedStats.modelsCount}</span></Text>
                  <Text size="xs" c="var(--orcha-text-body)">🔗 Relationships found: <span style={{ fontWeight: 700, color: "var(--orcha-purple)" }}>{parsedStats.relationshipsCount}</span></Text>
                </Group>
              </Stack>
            </Paper>
          )}

          <Group justify="flex-end" gap="md" mt="md">
            <Button variant="subtle" color="gray" size="xs" disabled={isImporting} onClick={() => setDbtModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="violet"
              size="xs"
              loading={isImporting}
              disabled={!manifestJson}
              onClick={handleDbtImport}
              leftSection={<IconDatabaseImport size={14} />}
            >
              Confirm Import
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}