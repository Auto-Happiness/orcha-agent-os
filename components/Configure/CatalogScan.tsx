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
  Grid
} from "@mantine/core";
import { 
  IconTable, 
  IconChevronDown, 
  IconChevronRight, 
} from "@tabler/icons-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

interface CatalogScanProps {
  configId: string;
}

export function CatalogScan({ configId }: CatalogScanProps) {
  const models = useQuery(api.semanticModels.listModelsByConfig, { configId: configId as any });
  const { data, updateData } = useCreationWizard();
  const [openedTables, setOpenedTables] = useState<Record<string, boolean>>({});

  const toggleTable = (tableName: string) => {
    setOpenedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

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
          <Text fw={600} size="sm" c="white">Detected Tables ({models.length})</Text>
          <Text size="11px" c="dimmed">Select the tables you want to include in your semantic layer.</Text>
        </Stack>
        <Badge variant="dot" color="violet">{data.selectedTables?.length || 0} selected</Badge>
      </Group>

      <Paper withBorder style={{ 
        background: "rgba(255,255,255,0.01)", 
        borderColor: "rgba(147,51,234,0.12)",
        overflow: "hidden"
      }} radius="md">
        <ScrollArea h={500}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead style={{ background: "rgba(0,0,0,0.2)", position: "sticky", top: 0, zIndex: 10 }}>
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
                        <Text size="sm" fw={500} c="white">{model.tableName}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td onClick={() => toggleTable(model.tableName)}>
                      <Text size="xs" c="dimmed">{model.fields.length} columns</Text>
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
                  <Table.Tr style={{ display: openedTables[model.tableName] ? "table-row" : "none", background: "rgba(0,0,0,0.15)" }}>
                    <Table.Td colSpan={5} p={0}>
                       <Box p="md" pl={rem(60)}>
                          <Grid>
                            {model.fields.map((field) => (
                              <Grid.Col span={4} key={field.columnName}>
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
                                  <Text size="10px" c="gray.6">{field.type.toUpperCase()}</Text>
                                </Group>
                              </Grid.Col>
                            ))}
                          </Grid>
                       </Box>
                    </Table.Td>
                  </Table.Tr>
                </React.Fragment>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

import React from "react";
