"use client";

import React from "react";
import { Box, Group, ActionIcon, Divider, Text, Badge, Button, Menu, Stack, Select } from "@mantine/core";
import { 
  IconArrowLeft, 
  IconBold, 
  IconItalic, 
  IconUnderline, 
  IconAlignLeft, 
  IconAlignCenter, 
  IconAlignRight, 
  IconCloudUpload, 
  IconDeviceFloppy,
  IconChevronDown,
  IconDatabase,
  IconSparkles,
  IconFocus2,
  IconTerminal2
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";

interface ToolbarProps {
  saas: string;
  selection: string | null;
  onSave: () => void;
  configs?: any[];
  selectedConfigId?: string;
  onConfigChange?: (id: string) => void;
  queries?: any[];
  selectedQueryId?: string;
  onQueryChange?: (id: string) => void;
  minimal?: boolean;
  disableConfig?: boolean;
}

export function SpreadsheetToolbar({ 
  saas, 
  selection, 
  onSave, 
  configs = [], 
  selectedConfigId, 
  onConfigChange,
  queries = [],
  selectedQueryId,
  onQueryChange,
  minimal = false,
  disableConfig = false
}: ToolbarProps) {
  const router = useRouter();

  if (minimal) {
    return (
      <Stack gap={4}>
        {!disableConfig && (
           <Select 
            placeholder="Environment..." 
            size="xs"
            data={configs.map(c => ({ value: c._id, label: c.name }))}
            value={selectedConfigId}
            onChange={(val) => onConfigChange?.(val || "")}
            variant="unstyled"
            leftSection={<IconDatabase size={12} color="#9333ea" />}
            styles={{ input: { color: "white", fontSize: "11px" } }}
          />
        )}
        {(disableConfig || selectedConfigId) && (
          <Select 
            placeholder="Pick Saved Query..." 
            size="xs"
            data={queries.map(q => ({ value: q._id, label: q.name }))}
            value={selectedQueryId}
            onChange={(val) => onQueryChange?.(val || "")}
            variant="unstyled"
            leftSection={<IconTerminal2 size={12} color="#60a5fa" />}
            styles={{ input: { color: "white", fontSize: "11px" } }}
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={0} w="100%">
      {/* Primary Toolbar */}
      <Box px="md" py={6} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <Group justify="space-between">
          <Group gap="xs">
            <ActionIcon variant="subtle" color="dimmed" onClick={() => router.push(`/${saas}/reports`)}>
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Divider orientation="vertical" />
            <Text fw={600} size="sm" c="white">Report Studio</Text>
            <Badge color="green" variant="light" size="xs">Live</Badge>
            {selection && (
              <Group gap={4} ml="md" style={{ opacity: 0.6 }}>
                <IconFocus2 size={12} color="#4ade80" />
                <Text size="xs" c="green.4" fw={700}>{selection}</Text>
              </Group>
            )}
          </Group>
          
          <Group gap="xs">
            <Button variant="subtle" color="dimmed" size="xs" leftSection={<IconCloudUpload size={14} />}>Import Template</Button>
            <Button 
              variant="gradient" 
              gradient={{ from: 'green.7', to: 'green.5' }} 
              size="xs" 
              leftSection={<IconDeviceFloppy size={14} />}
              onClick={onSave}
            >
              Save Report
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Configuration & Query Bar */}
      <Box px="md" py={8} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
        <Group gap="xl">
          <Group gap="xs">
            <Text size="xs" fw={700} c="dimmed">ENVIRONMENT:</Text>
            <Select 
              placeholder="Select Deployment" 
              size="xs"
              data={configs.map(c => ({ value: c._id, label: c.name }))}
              value={selectedConfigId}
              onChange={(val) => onConfigChange?.(val || "")}
              leftSection={<IconDatabase size={14} color="#9333ea" />}
              variant="unstyled"
              styles={{ input: { color: "white", fontWeight: 600, width: 180 } }}
            />
          </Group>
          
          <Divider orientation="vertical" />

          <Group gap="xs">
            <Text size="xs" fw={700} c="dimmed">DATA SOURCE:</Text>
            <Select 
              placeholder="Select Saved Query" 
              size="xs"
              data={queries.map(q => ({ value: q._id, label: q.name }))}
              value={selectedQueryId}
              onChange={(val) => onQueryChange?.(val || "")}
              leftSection={<IconTerminal2 size={14} color="#60a5fa" />}
              variant="unstyled"
              disabled={!selectedConfigId}
              styles={{ input: { color: "white", fontWeight: 600, width: 220 } }}
            />
          </Group>

          <Divider orientation="vertical" />

          <Group gap={4}>
            <ActionIcon variant="subtle" size="sm" color="dimmed"><IconBold size={14} /></ActionIcon>
            <ActionIcon variant="subtle" size="sm" color="dimmed"><IconItalic size={14} /></ActionIcon>
            <ActionIcon variant="subtle" size="sm" color="dimmed"><IconUnderline size={14} /></ActionIcon>
            <Divider orientation="vertical" h={14} mx={4} />
            <ActionIcon variant="subtle" size="sm" color="dimmed"><IconAlignLeft size={14} /></ActionIcon>
            <ActionIcon variant="subtle" size="sm" color="dimmed"><IconAlignCenter size={14} /></ActionIcon>
            <ActionIcon variant="subtle" size="sm" color="dimmed"><IconAlignRight size={14} /></ActionIcon>
          </Group>
        </Group>
      </Box>
    </Stack>
  );
}


