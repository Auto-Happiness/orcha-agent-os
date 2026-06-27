"use client";

import {
  Card,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Grid,
  Divider,
  Box,
  rem,
} from "@mantine/core";
import { IconRobot, IconBolt } from "@tabler/icons-react";
import { useState } from "react";
import { ModelProviderSelector } from "./ModelProviderSelector";
import { ModelConfigForm } from "./ModelConfigForm";

export function LLMConfig() {
  const [selectedProvider, setSelectedProvider] = useState("google");

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder style={{
          background: "var(--orcha-panel)",
          borderColor: "var(--orcha-border)",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          overflow: "hidden"
        }} radius="md" p={0} h={640}>
          {/* Left Vertical Selector Pane */}
          <Box p="xl" w={rem(300)} style={{ borderRight: "1px solid var(--orcha-border)", flexShrink: 0, background: "var(--orcha-surface)" }}>
            <ModelProviderSelector
              selected={selectedProvider}
              onSelect={setSelectedProvider}
            />
          </Box>

          {/* Right Content Form Pane */}
          <Box p="xl" style={{ flex: 1, overflowY: "auto" }}>
            <Box mb="xl">
              <Group justify="space-between" mb="xs">
                <Stack gap={0}>
                  <Text fw={700} size="lg" c="var(--orcha-text-title)">Model Intelligence</Text>
                  <Text size="xs" c="dimmed">Configure the large language models powering your agents.</Text>
                </Stack>
                <ThemeIcon variant="light" color="violet" size="lg" radius="md">
                  <IconRobot size={20} />
                </ThemeIcon>
              </Group>
              <Divider style={{ borderColor: "var(--orcha-border)" }} mt="md" />
            </Box>

            <ModelConfigForm provider={selectedProvider} />
          </Box>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
