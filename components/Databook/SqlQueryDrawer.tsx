"use client";

import React from "react";
import { Drawer, Stack, Group, Text, Button, Box, Code } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

interface SqlQueryDrawerProps {
  opened: boolean;
  onClose: () => void;
  sql: string;
}

export function SqlQueryDrawer({ opened, onClose, sql }: SqlQueryDrawerProps) {
  const handleCopySql = (text: string) => {
    navigator.clipboard.writeText(text);
    notifications.show({
      title: "SQL Copied",
      message: "SQL query copied to clipboard.",
      color: "violet",
      autoClose: 2000,
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="SQL Query"
      position="right"
      size="lg"
      overlayProps={{
        color: "#05010d",
        opacity: 0.85,
        blur: 10,
      }}
      styles={{
        content: { background: "var(--orcha-panel)", borderLeft: "1px solid var(--orcha-border)", padding: "1.5rem" },
        header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)", paddingBottom: "1rem" },
        title: { color: "var(--orcha-text-title)", fontWeight: 600 }
      }}
    >
      <Stack gap="md" style={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column" }}>
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            This SQL query was executed to fetch the results shown.
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            color="violet"
            leftSection={<IconCopy size={11} />}
            onClick={() => handleCopySql(sql)}
          >
            Copy SQL
          </Button>
        </Group>
        <Box style={{ background: "var(--orcha-surface)", border: "1px solid var(--orcha-border)", borderRadius: 8, padding: "12px", flex: 1, overflowY: "auto" }}>
          <Code block style={{ background: "transparent", color: "var(--orcha-text-body)", fontSize: 11, padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {sql}
          </Code>
        </Box>
      </Stack>
    </Drawer>
  );
}
