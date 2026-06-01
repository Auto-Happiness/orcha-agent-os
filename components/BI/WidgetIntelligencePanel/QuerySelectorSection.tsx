import React, { useState } from "react";
import { Box, Group, Text, Button, TextInput, Select, ActionIcon, Modal, Paper } from "@mantine/core";
import { IconDatabase, IconCode } from "@tabler/icons-react";

interface QuerySelectorSectionProps {
  widgetTitle: string;
  onChangeWidgetTitle: (val: string) => void;
  selectedConfigId: string | null;
  onChangeSelectedConfigId: (id: string | null) => void;
  selectedQueryId: string | null;
  onChangeSelectedQueryId: (id: string | null) => void;
  configs: any[] | undefined;
  nonFederatedQueries: any[];
}

export function QuerySelectorSection({
  widgetTitle,
  onChangeWidgetTitle,
  selectedConfigId,
  onChangeSelectedConfigId,
  selectedQueryId,
  onChangeSelectedQueryId,
  configs,
  nonFederatedQueries,
}: QuerySelectorSectionProps) {
  const [sqlModalOpened, setSqlModalOpened] = useState(false);

  const handleSyncWithQueryName = () => {
    const query = nonFederatedQueries.find((q) => q._id === selectedQueryId);
    if (query) {
      onChangeWidgetTitle(query.name);
    }
  };

  const getDbIconColor = () => {
    const config = configs?.find((c) => c._id === selectedConfigId);
    if (config?.type === "mysql") return "blue";
    if (config?.type === "mssql") return "red";
    if (config?.type === "oracle") return "orange";
    return "gray";
  };

  const selectedQuerySql = nonFederatedQueries.find((q) => q._id === selectedQueryId)?.sql || "-- No SQL found --";

  return (
    <Box>
      <Box mb="xl">
        <Group mb="xs" justify="space-between">
          <Text size="sm" fw={600} c="dimmed">
            CHART IDENTITY
          </Text>
          {selectedQueryId && (
            <Button variant="subtle" size="compact-xs" color="cyan" onClick={handleSyncWithQueryName}>
              Sync with Query Name
            </Button>
          )}
        </Group>
        <TextInput
          placeholder="e.g. Monthly Revenue Trend"
          size="md"
          value={widgetTitle}
          onChange={(e) => onChangeWidgetTitle(e.currentTarget.value)}
        />
      </Box>

      <Group grow align="flex-start" gap="md">
        <Box>
          <Group mb="xs">
            <IconDatabase size={16} color="gray" />
            <Text size="sm" fw={600} c="dimmed">
              1. ENVIRONMENT
            </Text>
          </Group>
          <Select
            placeholder="Select source..."
            data={configs?.map((c) => ({ value: c._id, label: c.name })) || []}
            value={selectedConfigId}
            onChange={onChangeSelectedConfigId}
            size="md"
            leftSection={<IconDatabase size={16} color={getDbIconColor()} />}
          />
        </Box>
        <Box>
          <Group mb="xs">
            <IconDatabase size={16} color="gray" />
            <Text size="sm" fw={600} c="dimmed">
              2. SAVED QUERY
            </Text>
          </Group>
          <Group align="flex-end" gap="xs">
            <Select
              placeholder={selectedConfigId ? "Choose a query..." : "Select environment first"}
              data={nonFederatedQueries.map((q) => ({ value: q._id, label: q.name })) || []}
              value={selectedQueryId}
              onChange={onChangeSelectedQueryId}
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
          header: { background: "transparent" },
        }}
      >
        <Paper p="md" bg="rgba(0,0,0,0.3)" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
          <pre
            style={{
              margin: 0,
              color: "var(--mantine-color-cyan-4)",
              fontSize: "14px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
            }}
          >
            {selectedQuerySql}
          </pre>
        </Paper>
      </Modal>
    </Box>
  );
}
