"use client";

import { Stack, Paper, Title, Text, Divider, Group, Button } from "@mantine/core";

export function SecurityTab() {
  return (
    <Paper withBorder p="2.5rem" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
      <Stack gap="xl">
        <Title order={3} size="1.5rem">Security Settings</Title>
        <Text size="sm" c="dimmed">Manage your password, two-factor authentication, and active sessions.</Text>
        
        <Divider color="rgba(255,255,255,0.05)" />
        
        <Group justify="space-between">
          <Stack gap={4}>
            <Text fw={600} size="sm">Two-Factor Authentication</Text>
            <Text size="xs" c="dimmed">Add an extra layer of security to your account.</Text>
          </Stack>
          <Button variant="light" color="gray" size="xs">Enable</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
