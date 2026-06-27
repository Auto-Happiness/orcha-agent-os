import React from "react";
import { Box, Group, Text, Popover, Button, Stack, List, ThemeIcon, Alert, Badge, Paper, ScrollArea, Table } from "@mantine/core";
import { IconSparkles, IconCheck, IconAlertCircle, IconInfoCircle, IconPlayerPlay } from "@tabler/icons-react";

interface ValidationLog {
  type: "success" | "warning" | "info";
  message: string;
  id: string;
}

interface SchemaDiscoverySectionProps {
  selectedQueryId: string | null;
  validationLogs: ValidationLog[];
  onExecute: () => void;
  isExecuting: boolean;
  executionError: string | null;
  discoveredColumns: string[];
  previewRows: any[];
}

export function SchemaDiscoverySection({
  selectedQueryId,
  validationLogs,
  onExecute,
  isExecuting,
  executionError,
  discoveredColumns,
  previewRows,
}: SchemaDiscoverySectionProps) {
  if (!selectedQueryId) return null;

  const hasWarning = validationLogs.some((l) => l.type === "warning");

  return (
    <Box mt="xl">
      <Group justify="space-between" align="center" mb="xs">
        <Text size="xs" fw={700} c="dimmed">
          3. DATA DISCOVERY
        </Text>
        <Popover width={480} position="bottom-end" withArrow shadow="md" radius="md">
          <Popover.Target>
            <Button
              variant="subtle"
              color={hasWarning ? "orange" : "cyan"}
              size="compact-xs"
              leftSection={<IconSparkles size={14} />}
            >
              Smart Advisor {validationLogs.length > 0 && `(${validationLogs.length})`}
            </Button>
          </Popover.Target>
          <Popover.Dropdown bg="var(--orcha-panel)" style={{ border: "1px solid var(--orcha-border)" }}>
            <Stack gap="md">
              <Text size="sm" fw={700} c="dimmed" mb={4}>
                DIAGNOSTIC LOGS
              </Text>
              {validationLogs.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No analysis available yet.
                </Text>
              ) : (
                <List spacing="md" size="sm">
                  {validationLogs.map((log) => (
                    <List.Item
                      key={log.id}
                      icon={
                        <ThemeIcon
                          color={log.type === "success" ? "green" : log.type === "warning" ? "orange" : "blue"}
                          size={24}
                          radius="xl"
                        >
                          {log.type === "success" ? (
                            <IconCheck size={14} />
                          ) : log.type === "warning" ? (
                            <IconAlertCircle size={14} />
                          ) : (
                            <IconInfoCircle size={14} />
                          )}
                        </ThemeIcon>
                      }
                    >
                      <Text size="sm" c={log.type === "warning" ? "orange.4" : "var(--orcha-text-body)"} ml={4}>
                        {log.message}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>

      <Button
        variant="light"
        color="violet"
        fullWidth
        onClick={onExecute}
        loading={isExecuting}
        leftSection={<IconPlayerPlay size={16} />}
      >
        Execute & Discover Schema
      </Button>

      {executionError && (
        <Alert color="red" mt="sm">
          {executionError}
        </Alert>
      )}

      {discoveredColumns.length > 0 && (
        <Stack gap="md" mt="md">
          <Box p="xs" style={{ background: "var(--orcha-surface)", border: "1px solid var(--orcha-border)", borderRadius: 8 }}>
            <Text size="xs" fw={700} mb="xs" c="var(--orcha-purple)">
              DISCOVERED SCHEMA
            </Text>
            <Group gap={4}>
              {discoveredColumns.map((col) => (
                <Badge key={col} variant="dot" color="violet" size="sm">
                  {col}
                </Badge>
              ))}
            </Group>
          </Box>
          <Box>
            <Text size="xs" fw={700} mb={8} c="dimmed">
              DATA PREVIEW (FIRST 10 ROWS)
            </Text>
            <Paper
              p={0}
              radius="md"
              withBorder
              style={{
                background: "var(--orcha-surface)",
                borderColor: "var(--orcha-border)",
                overflow: "hidden",
              }}
            >
              <ScrollArea h={200}>
                <Table highlightOnHover withColumnBorders verticalSpacing="xs">
                  <Table.Thead style={{ background: "var(--orcha-sidebar-hover-bg)" }}>
                    <Table.Tr>
                      {discoveredColumns.map((col) => (
                        <Table.Th
                          key={col}
                          style={{
                            color: "var(--orcha-text-body)",
                            borderBottom: "1px solid var(--orcha-border)",
                          }}
                        >
                          {col}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {previewRows.slice(0, 10).map((row, i) => (
                      <Table.Tr key={i}>
                        {discoveredColumns.map((col) => (
                          <Table.Td
                            key={col}
                            style={{
                              color: "var(--orcha-text-body)",
                              borderColor: "var(--orcha-table-border)",
                            }}
                          >
                            {row[col]}
                          </Table.Td>
                        ))}
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
  );
}
