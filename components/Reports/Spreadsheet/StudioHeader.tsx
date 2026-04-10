"use client";

import React from "react";
import { Box, Group, Stack, Text, ActionIcon, Divider, Badge, Button, Switch } from "@mantine/core";
import { IconArrowLeft, IconRocket, IconSettings, IconEye, IconCode } from "@tabler/icons-react";
import Link from "next/link";

interface StudioHeaderProps {
  saas: string;
  fileName: string | null;
  showSampleData: boolean;
  onToggleSampleData: (val: boolean) => void;
  onDeploy: () => void;
}

export function StudioHeader({ 
  saas, 
  fileName, 
  showSampleData, 
  onToggleSampleData, 
  onDeploy 
}: StudioHeaderProps) {
  return (
    <Box px="md" py={10} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
      <Group justify="space-between">
        <Group gap="xl">
          <ActionIcon variant="subtle" color="dimmed" component={Link} href={`/${saas}/reports`}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Divider orientation="vertical" h={20} />
          <Stack gap={0}>
            <Group gap="xs">
              <Text fw={700} size="sm">Report Studio</Text>
              <Badge variant="dot" color="violet" size="xs">Live Editor</Badge>
            </Group>
            <Text size="10px" c="dimmed">Template: {fileName || "Untitled.xlsx"}</Text>
          </Stack>
        </Group>

        <Group gap="xl">
          <Group gap="xs">
            <Text size="xs" fw={500} c={showSampleData ? "green.4" : "dimmed"}>
              {showSampleData ? "Sample Data Mode" : "Marker View"}
            </Text>
            <Switch 
              size="sm" 
              color="green"
              checked={showSampleData}
              onChange={(e) => onToggleSampleData(e.currentTarget.checked)}
              thumbIcon={showSampleData ? <IconEye size={10} color="green" /> : <IconCode size={10} color="gray" />}
            />
          </Group>

          <Divider orientation="vertical" h={20} />

          <Group gap="md">
            <Button 
                variant="subtle" 
                color="dimmed" 
                size="xs" 
                leftSection={<IconSettings size={14} />}
            >
                Settings
            </Button>
            <Button 
                variant="gradient" 
                gradient={{ from: 'violet.7', to: 'violet.5' }} 
                size="sm" 
                radius="md" 
                leftSection={<IconRocket size={16} />}
                onClick={onDeploy}
            >
                Deploy generator
            </Button>
          </Group>
        </Group>
      </Group>
    </Box>
  );
}
