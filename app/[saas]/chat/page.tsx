"use client";

import { useChat } from "@ai-sdk/react";
import {
  TextInput,
  Button,
  Stack,
  Paper,
  Text,
  Group,
  ScrollArea,
  Box,
  Alert,
  Badge,
  Avatar,
  Loader,
  ActionIcon,
  Tooltip
} from "@mantine/core";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { IconSend, IconDatabaseOff, IconRobot, IconUser, IconAlertCircle, IconDownload, IconExternalLink } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

export default function ChatPage() {
  const { organization } = useOrganization();
  const isConnected = useQuery(
    api.databaseConfigs.isConnected,
    organization?.id ? { organizationId: organization.id as any } : "skip"
  );

  // const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  //   api: "/api/chat",
  //   body: { organizationId: organization?.id },
  // });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // Handle "No Connection" State
  if (isConnected === false) {
    return (
      <Box p="xl" maw={600} mx="auto">
        <Alert
          variant="light"
          color="red"
          title="No Data Source Connected"
          icon={<IconDatabaseOff size={24} />}
          radius="md"
        >
          <Text size="sm" mb="md">
            The Agent cannot respond because your workspace does not have a database connected.
            Please head to the <b>Pipelines</b> section to link your PostgreSQL or BigQuery source.
          </Text>
          <Button variant="outline" color="red" size="xs" component="a" href="pipelines">
            Connect Database
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Stack h="calc(100vh - 120px)" p="md" gap="md">
      {/* Header Info */}
      <Group justify="space-between" px="xs">
        <Group gap="xs">
          <Badge color="violet" variant="filled" size="sm" leftSection={<IconRobot size={10} />}>
            AI Agent Active
          </Badge>
          <Text size="xs" c="dimmed">Talk to your connected database</Text>
        </Group>
      </Group>

      {/* Chat History */}
      <Paper
        withBorder
        shadow="xs"
        p={0}
        style={{ flex: 1, overflow: "hidden", background: "rgba(255,255,255,0.02)", borderColor: "rgba(147,51,234,0.12)" }}
      >
        <ScrollArea h="100%" viewportRef={scrollRef} p="md">
          <Stack gap="lg">
            {messages.length === 0 && (
              <Box ta="center" py={50}>
                <Avatar size={60} radius="xl" color="violet" mx="auto" mb="md">
                  <IconRobot size={32} />
                </Avatar>
                <Text fw={600} size="lg">How can I help with your data today?</Text>
                <Text size="sm" c="dimmed">Ask me about your inventory, sales, or users.</Text>
              </Box>
            )}

            {messages.map((m) => (
              <Group key={m.id} align="flex-start" wrap="nowrap" justify={m.role === "user" ? "flex-end" : "flex-start"}>
                {m.role !== "user" && <Avatar size="sm" color="violet" radius="xl"><IconRobot size={16} /></Avatar>}

                <Paper
                  p="sm"
                  radius="md"
                  maw="80%"
                  style={{
                    background: m.role === "user" ? "#9333ea" : "rgba(255,255,255,0.05)",
                    color: m.role === "user" ? "white" : "inherit",
                    border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.1)"
                  }}
                >
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{m.content}</Text>

                  {/* Handle Bridge Tool Calls (Simulated) */}
                  {m.content.includes("Background CSV export") && (
                    <Box mt="xs" p="xs" style={{ background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                      <Group justify="space-between">
                        <Text size="xs" fw={700}>CSV EXPORT QUEUED</Text>
                        <IconDownload size={14} />
                      </Group>
                      <Text size="xs">I'll notify you here when the 10M rows are ready.</Text>
                    </Box>
                  )}
                </Paper>

                {m.role === "user" && <Avatar size="sm" color="blue" radius="xl"><IconUser size={16} /></Avatar>}
              </Group>
            ))}

            {isLoading && (
              <Group gap="xs">
                <Avatar size="sm" color="violet" radius="xl"><IconRobot size={16} /></Avatar>
                <Loader size="xs" color="violet" type="dots" />
              </Group>
            )}
          </Stack>
        </ScrollArea>
      </Paper>

      {/* Input Area */}
      <form onSubmit={handleSubmit}>
        <Group>
          <TextInput
            placeholder="Query your database..."
            style={{ flex: 1 }}
            value={input}
            onChange={handleInputChange}
            radius="md"
            styles={{ input: { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "white" } }}
          />
          <Button
            type="submit"
            color="violet"
            variant="filled"
            radius="md"
            disabled={isLoading || !isConnected}
          >
            <IconSend size={18} />
          </Button>
        </Group>
      </form>
    </Stack>
  );
}
