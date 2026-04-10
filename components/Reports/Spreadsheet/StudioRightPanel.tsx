"use client";

import React from "react";
import { 
  Box, 
  Stack, 
  Text, 
  Paper, 
  ThemeIcon, 
  Button, 
  ScrollArea, 
  Divider, 
  Select, 
  Group,
  UnstyledButton,
  Badge,
  Loader
} from "@mantine/core";
import { 
  IconFileSpreadsheet, 
  IconUpload, 
  IconDatabase, 
  IconTerminal2, 
  IconSparkles,
  IconPlayerPlay,
  IconCheck
} from "@tabler/icons-react";

interface StudioRightPanelProps {
  configs: any[];
  selectedConfigId: string;
  onConfigChange: (id: string) => void;
  queries: any[];
  selectedQueryId: string;
  onQueryChange: (id: string) => void;
  onExecute: () => void;
  isExecuting: boolean;
  hasExecuted: boolean;
  availableMarkers: string[];
  onInsertMarker: (marker: string) => void;
  onUpload: () => void;
  fileName: string | null;
}

export function StudioRightPanel({ 
  configs, 
  selectedConfigId, 
  onConfigChange,
  queries,
  selectedQueryId,
  onQueryChange,
  onExecute,
  isExecuting,
  hasExecuted,
  availableMarkers,
  onInsertMarker,
  onUpload,
  fileName
}: StudioRightPanelProps) {
  return (
    <Box w={320} style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
      <ScrollArea h="100%" p="md">
        <Stack gap="xl">
          {/* 1. Template */}
          <Box>
            <Text size="xs" fw={700} c="dimmed" mb="md" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>1. Design Template</Text>
            <Paper p="md" radius="md" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)" }}>
              <Stack align="center" gap="xs">
                <ThemeIcon size="xl" radius="xl" variant="light" color="green">
                  <IconFileSpreadsheet size={24} />
                </ThemeIcon>
                {fileName ? (
                  <Text size="sm" fw={600} ta="center">{fileName}</Text>
                ) : (
                  <Text size="xs" c="dimmed" ta="center">Upload XLSX with markers</Text>
                )}
                <Button size="compact-xs" fullWidth variant="light" color="green" leftSection={<IconUpload size={12} />} mt="xs" onClick={onUpload}>
                  {fileName ? "Replace File" : "Upload File"}
                </Button>
              </Stack>
            </Paper>
          </Box>

          <Divider color="rgba(255,255,255,0.05)" />

          {/* 2. Data Source */}
          <Box>
            <Text size="xs" fw={700} c="dimmed" mb="md" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>2. Connect & Execute</Text>
            <Stack gap="sm">
              <Select 
                label={<Text size="10px" c="dimmed">Environment</Text>}
                placeholder="Select Deployment" 
                size="xs"
                data={configs.map(c => ({ value: c._id, label: c.name }))}
                value={selectedConfigId}
                onChange={(val) => onConfigChange(val || "")}
                leftSection={<IconDatabase size={14} color="#9333ea" />}
              />
              <Select 
                label={<Text size="10px" c="dimmed">Saved Query</Text>}
                placeholder="Select Saved Query" 
                size="xs"
                data={queries.map(q => ({ value: q._id, label: q.name }))}
                value={selectedQueryId}
                onChange={(val) => onQueryChange(val || "")}
                leftSection={<IconTerminal2 size={14} color="#60a5fa" />}
                disabled={!selectedConfigId}
              />
              <Button 
                variant="light" 
                color="blue" 
                size="xs" 
                fullWidth 
                mt="xs"
                leftSection={isExecuting ? <Loader size={12} color="blue" /> : <IconPlayerPlay size={12} />}
                disabled={!selectedQueryId || isExecuting}
                onClick={onExecute}
              >
                {isExecuting ? "Executing..." : "Execute Query"}
              </Button>
            </Stack>
          </Box>

          <Divider color="rgba(255,255,255,0.05)" />

          {/* 3. Field Library */}
          <Box>
            <Group justify="space-between" mb="md">
               <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>3. Field Library</Text>
               {hasExecuted && <Badge size="xs" color="green" variant="light">Discovery Live</Badge>}
            </Group>
            
            {hasExecuted ? (
              <Stack gap={6}>
                <Text size="10px" c="dimmed">Click a cell then pick a field:</Text>
                <Box style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {availableMarkers.map(m => (
                    <UnstyledButton 
                      key={m} 
                      onClick={() => onInsertMarker(m)}
                      style={{ 
                        padding: "4px 8px", 
                        borderRadius: "4px", 
                        background: "rgba(255,255,255,0.04)", 
                        border: "1px solid rgba(255,255,255,0.08)",
                        transition: "all 0.2s ease"
                      }}
                      className="field-chip"
                    >
                      <Group gap={4}>
                        <IconSparkles size={10} color="#a855f7" />
                        <Text size="xs" c="white" ff="monospace">{m.replace("{d.", "").replace("}", "")}</Text>
                      </Group>
                    </UnstyledButton>
                  ))}
                </Box>
              </Stack>
            ) : (
              <Paper p="sm" radius="md" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                 <Text size="xs" c="dimmed" ta="center">Execute a query to unlock data fields.</Text>
              </Paper>
            )}
          </Box>

          {/* Automation Status */}
          <Paper p="sm" radius="md" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.1)" }}>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                   <ThemeIcon color="violet" variant="light" size="xs"><IconCheck size={10} /></ThemeIcon>
                   <Text size="10px" c="violet.2">
                      All mappings use the <strong>Carbone tag engine</strong>. Your original Excel formatting will be preserved.
                   </Text>
              </Group>
          </Paper>
        </Stack>
      </ScrollArea>
    </Box>
  );
}
