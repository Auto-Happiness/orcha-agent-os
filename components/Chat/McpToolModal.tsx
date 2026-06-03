"use client";

import React from "react";
import { Modal, Group, Text, Stack, ScrollArea, Box, Badge, Paper, Code } from "@mantine/core";
import { IconPlugConnected } from "@tabler/icons-react";

export interface McpToolCall {
  name: string;
  args: any;
  result?: any;
}

export function McpToolModal({
  calls,
  opened,
  onClose,
}: {
  calls: McpToolCall[];
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconPlugConnected size={18} color="#a855f7" />
          <Text fw={700} size="md" c="white">MCP Tool Executions</Text>
        </Group>
      }
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.6, blur: 4 }}
      styles={{
        content: {
          background: "#130f22",
          border: "1px solid rgba(147, 51, 234, 0.2)",
          borderRadius: 12,
        },
        header: {
          background: "#130f22",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          color: "white",
        },
      }}
    >
      <Stack gap="md" mt="sm">
        <Text size="xs" c="dimmed">
          The following external MCP tools were executed during this turn.
        </Text>
        <ScrollArea h={400} offsetScrollbars>
          <Stack gap="lg">
            {calls.map((call, i) => (
              <Box
                key={i}
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.02)",
                  overflow: "hidden"
                }}
              >
                {/* Header */}
                <Box
                  p="xs"
                  px="sm"
                  style={{
                    background: "rgba(147, 51, 234, 0.08)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
                  }}
                >
                  <Group justify="space-between">
                    <Text size="sm" fw={700} c="violet.3">
                      {call.name}
                    </Text>
                    <Badge size="xs" variant="light" color="violet">
                      Tool Call #{i + 1}
                    </Badge>
                  </Group>
                </Box>

                {/* Body */}
                <Stack gap="xs" p="sm">
                  <Box>
                    <Text size="xs" fw={700} c="rgba(255, 255, 255, 0.65)" mb={4}>
                      Parameters (Arguments):
                    </Text>
                    <Paper
                      withBorder
                      p="xs"
                      radius="sm"
                      style={{
                        background: "rgba(0, 0, 0, 0.2)",
                        borderColor: "rgba(255, 255, 255, 0.06)"
                      }}
                    >
                      <Code block style={{ background: "transparent", color: "#a855f7", fontSize: 11, fontFamily: "monospace" }}>
                        {JSON.stringify(call.args, null, 2)}
                      </Code>
                    </Paper>
                  </Box>

                  {call.result !== undefined && (
                    <Box>
                      <Text size="xs" fw={700} c="rgba(255, 255, 255, 0.65)" mb={4}>
                        Execution Result:
                      </Text>
                      <Paper
                        withBorder
                        p="xs"
                        radius="sm"
                        style={{
                          background: "rgba(0, 0, 0, 0.3)",
                          borderColor: "rgba(255, 255, 255, 0.06)"
                        }}
                      >
                        <Code block style={{ background: "transparent", color: "#22c55e", fontSize: 11, fontFamily: "monospace" }}>
                          {JSON.stringify(call.result, null, 2)}
                        </Code>
                      </Paper>
                    </Box>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
