"use client";

import {
  Stack,
  Group,
  Text,
  Box,
  Checkbox,
  Table,
  Badge,
  ScrollArea,
  Loader,
  rem,
  Paper,
  ActionIcon,
  Grid,
  Tooltip
} from "@mantine/core";
import {
  IconTable,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import React, { useState, useEffect, useRef } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { useIntersection } from "@mantine/hooks";
import { api } from "@/convex/_generated/api";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

interface CatalogScanProps {
  configId: string;
}

export function CatalogScan({ configId }: CatalogScanProps) {
  const { results: models, status: modelsStatus, loadMore: loadMoreModels } = usePaginatedQuery(
    api.semanticModels.listModelSummariesByConfig, 
    { configId: configId as any },
    { initialNumItems: 100 }
  );

  const { data, updateData } = useCreationWizard();
  const [openedTables, setOpenedTables] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: sentinelRef, entry } = useIntersection({
    root: containerRef.current,
    threshold: 0.1,
  });

  useEffect(() => {
    if (entry?.isIntersecting && modelsStatus === "CanLoadMore") {
      loadMoreModels(100);
    }
  }, [entry, modelsStatus]);

  const toggleTable = (tableName: string) => {
    setOpenedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  // Auto-select all tables by default (Zero-Config)
  useEffect(() => {
    if (models && models.length > 0 && (!data.selectedTables || data.selectedTables.length === 0)) {
      updateData({ selectedTables: models.map(m => m.tableName) });
    }
  }, [models, data.selectedTables]);

  const handleToggleSelect = (tableName: string) => {
    const current = data.selectedTables || [];
    if (current.includes(tableName)) {
      updateData({ selectedTables: current.filter(t => t !== tableName) });
    } else {
      updateData({ selectedTables: [...current, tableName] });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && models) {
      updateData({ selectedTables: models.map(m => m.tableName) });
    } else {
      updateData({ selectedTables: [] });
    }
  };

  if (models === undefined) {
    return (
      <Stack align="center" py="xl">
        <Loader color="violet" size="lg" type="dots" />
        <Text size="sm" c="dimmed">Fetching catalog...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={0}>
          <Text fw={600} size="sm" c="var(--orcha-text-title)">Detected Tables ({models.length})</Text>
          <Text size="11px" c="dimmed">Select the tables you want to include in your semantic layer.</Text>
        </Stack>
        <Badge variant="dot" color="violet">{data.selectedTables?.length || 0} selected</Badge>
      </Group>

      <Paper withBorder style={{
        background: "var(--orcha-panel)",
        borderColor: "var(--orcha-border)",
        overflow: "hidden"
      }} radius="md">
        <ScrollArea h={600} offsetScrollbars viewportRef={containerRef}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead style={{ background: "var(--orcha-surface)", position: "sticky", top: 0, zIndex: 10 }}>
              <Table.Tr style={{ borderColor: "rgba(147,51,234,0.1)" }}>
                <Table.Th w={40}>
                  <Checkbox
                    size="xs"
                    color="violet"
                    checked={(data.selectedTables?.length || 0) === models.length && models.length > 0}
                    indeterminate={(data.selectedTables?.length || 0) > 0 && (data.selectedTables?.length || 0) < models.length}
                    onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                  />
                </Table.Th>
                <Table.Th>Table Name</Table.Th>
                <Table.Th>Columns</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {models.map((model) => (
                <React.Fragment key={model._id}>
                  <Table.Tr
                    style={{ borderColor: "rgba(147,51,234,0.05)", cursor: "pointer" }}
                  >
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        color="violet"
                        checked={data.selectedTables?.includes(model.tableName)}
                        onChange={() => handleToggleSelect(model.tableName)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Table.Td>
                    <Table.Td onClick={() => toggleTable(model.tableName)}>
                      <Group gap="xs">
                        <IconTable size={14} color="rgba(147,51,234,0.6)" />
                        <Text size="sm" fw={500} c="var(--orcha-text-title)">{model.tableName}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td onClick={() => toggleTable(model.tableName)}>
                      <Tooltip
                        label={(model.fields || []).map((f: any) => `${f.columnName} (${f.dataType || f.rawType || "unknown"})`).join(", ")}
                        multiline
                        w={350}
                        withArrow
                        disabled={!model.fields?.length}
                        styles={{ tooltip: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", color: "var(--foreground)" } }}
                      >
                        <Box>
                          <Text size="xs" c="dimmed" fw={500} mb={2}>
                            {model.fieldCount || 0} columns
                          </Text>
                          <Text size="10px" c="gray.6" truncate style={{ maxWidth: "250px" }}>
                            {(model.fields || []).map((f: any) => `${f.columnName} (${f.dataType || f.rawType || "unknown"})`).join(", ")}
                          </Text>
                        </Box>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td onClick={() => toggleTable(model.tableName)}>
                      <Badge size="xs" variant="light" color="gray">BASE_TABLE</Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <ActionIcon
                        variant="transparent"
                        color="dimmed"
                        size="sm"
                        onClick={() => toggleTable(model.tableName)}
                      >
                        {openedTables[model.tableName] ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr style={{ display: openedTables[model.tableName] ? "table-row" : "none", background: "var(--orcha-surface)" }}>
                    <Table.Td colSpan={5} p={0}>
                      <Box p="md" pl={rem(60)}>
                        <ScrollArea mah={200} type="auto" offsetScrollbars>
                          <Stack gap={4}>
                            {(model.fields || []).map((field: any) => (
                              <Group key={field.columnName} justify="space-between" wrap="nowrap" style={{
                                padding: "6px 12px",
                                borderRadius: "4px",
                              background: "var(--orcha-panel)",
                              }}>
                                <Group gap="xs">
                                  <Box
                                    w={6}
                                    h={6}
                                    style={{
                                      borderRadius: "50%",
                                      background: field.type === "measure" ? "#a855f7" : "#3b82f6"
                                    }}
                                  />
                                  <Text size="xs" c="dimmed" ff="monospace">{field.columnName}</Text>
                                </Group>
                                <Group gap="xs">
                                  <Badge size="xs" variant="light" color="violet" tt="none">
                                    {field.dataType || field.rawType || "unknown"}
                                  </Badge>
                                  <Badge size="xs" variant="light" color={field.type === "measure" ? "violet" : "blue"}>
                                    {field.type.toUpperCase()}
                                  </Badge>
                                </Group>
                              </Group>
                            ))}
                          </Stack>
                        </ScrollArea>
                      </Box>
                    </Table.Td>
                  </Table.Tr>
                </React.Fragment>
              ))}
              {modelsStatus === "CanLoadMore" && (
                <Table.Tr>
                  <Table.Td colSpan={5} ta="center" py="md" ref={sentinelRef}>
                    <Loader size="sm" color="violet" />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
