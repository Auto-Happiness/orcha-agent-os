"use client";

import { 
  Card, 
  Stack, 
  Group, 
  Text, 
  ThemeIcon, 
  Grid, 
  Paper,
  Divider,
  Box,
  rem
} from "@mantine/core";
import { IconLock, IconSettings, IconServer } from "@tabler/icons-react";
import { useState } from "react";
import { DatabaseProviderSelector } from "./DatabaseProviderSelector";
import { DatabaseConnectionForm } from "./DatabaseConnectionForm";

export function DatabaseConfig() {
  const [selectedProvider, setSelectedProvider] = useState("postgres");

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder style={{ 
          background: "rgba(255,255,255,0.01)", 
          borderColor: "rgba(147,51,234,0.12)",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          overflow: "hidden"
        }} radius="md" p={0} h={860}>
          {/* Left Vertical Selector Pane */}
          <Box p="xl" w={rem(300)} style={{ borderRight: "1px solid rgba(147,51,234,0.12)", flexShrink: 0, background: "rgba(0,0,0,0.15)" }}>
            <DatabaseProviderSelector 
              selected={selectedProvider} 
              onSelect={setSelectedProvider} 
            />
          </Box>

          {/* Right Content Form Pane */}
          <Box p="xl" style={{ flex: 1, overflowY: "auto" }}>
            <Box mb="xl">
              <Group justify="space-between" mb="xs">
                <Stack gap={0}>
                  <Text fw={700} size="lg" c="white">Source Connectivity</Text>
                  <Text size="xs" c="dimmed">Configure its parameters and authentication.</Text>
                </Stack>
                <ThemeIcon variant="light" color="violet" size="lg" radius="md">
                  <IconServer size={20} />
                </ThemeIcon>
              </Group>
              <Divider style={{ borderColor: "rgba(255,255,255,0.06)" }} mt="md" />
            </Box>

            <DatabaseConnectionForm provider={selectedProvider} />
          </Box>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
