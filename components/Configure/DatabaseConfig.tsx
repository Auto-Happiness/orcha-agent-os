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
import { IconServer } from "@tabler/icons-react";
import { useEffect } from "react";
import { DatabaseProviderSelector } from "./DatabaseProviderSelector";
import { DatabaseConnectionForm } from "./DatabaseConnectionForm";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function DatabaseConfig() {
  const { data, updateData } = useCreationWizard();

  // Ensure the store has a provider set; default to mysql if somehow blank
  const selectedProvider = data.dbProvider || "mysql";

  const handleSelectProvider = (provider: string) => {
    // Default port per provider so the form starts with the right value
    const defaultPorts: Record<string, string> = {
      mysql: "3306",
      postgres: "5432",
      mssql: "1433",
      mongodb: "27017",
      bigquery: "",
    };
    updateData({
      dbProvider: provider,
      // Reset port to match the new provider so users don't accidentally
      // keep e.g. port 1433 while switching back to MySQL
      dbConfig: {
        ...data.dbConfig,
        port: defaultPorts[provider] ?? "",
      },
    });
  };

  // Initialise on first mount if the store default ("postgres") doesn't match "mysql" UI default
  useEffect(() => {
    if (!data.dbProvider) {
      updateData({ dbProvider: "mysql" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              onSelect={handleSelectProvider} 
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
