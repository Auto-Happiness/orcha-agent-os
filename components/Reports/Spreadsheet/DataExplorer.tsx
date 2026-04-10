"use client";

import { Box, Stack, Group, Text, ActionIcon, Paper, ThemeIcon, UnstyledButton, Divider } from "@mantine/core";
import { IconSearch, IconSparkles, } from "@tabler/icons-react";

interface DataExplorerProps {
  activeCell: string | null;
  cells: Record<string, string>;
  onInsertMarker: (marker: string) => void;
  availableMarkers?: string[];
}

export function DataExplorer({
  activeCell,
  cells,
  onInsertMarker,
  availableMarkers = ["{d.rows}", "{d.summary.total}", "{d.date_range}"]
}: DataExplorerProps) {
  return (
    <Box w={280} style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", background: "#0c0918" }} p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>Data Explorer</Text>
          <ActionIcon variant="subtle" size="sm" color="dimmed"><IconSearch size={14} /></ActionIcon>
        </Group>

        <Paper p="xs" radius="sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Stack gap={4}>
            <Group gap="xs">
              <ThemeIcon size="xs" color="violet" variant="light"><IconSparkles size={10} /></ThemeIcon>
              <Text size="xs" fw={600} c="white">Available Fact Markers</Text>
            </Group>
            <Text size="10px" c="dimmed">Click to insert at selection:</Text>
            <Stack gap={4} mt={4}>
              {availableMarkers.map(m => (
                <UnstyledButton
                  key={m}
                  onClick={() => onInsertMarker(m)}
                  style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(255,255,255,0.03)" }}
                >
                  <Text size="xs" c="green.4" ff="monospace">{m}</Text>
                </UnstyledButton>
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Divider color="rgba(255,255,255,0.08)" label="Selection Info" labelPosition="center" />

        {activeCell ? (
          <Box>
            <Text size="xs" c="dimmed">Cell: <Text span c="white" fw={600}>{activeCell}</Text></Text>
            <Text size="xs" c="dimmed" mt={4}>Value: <Text span c="white">{cells[activeCell] || "(Empty)"}</Text></Text>
          </Box>
        ) : (
          <Text size="xs" c="dimmed" ta="center">Select a cell to view details</Text>
        )}
      </Stack>
    </Box>
  );
}
