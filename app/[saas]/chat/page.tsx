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
  Table,
} from "@mantine/core";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { IconSend, IconDatabaseOff, IconRobot, IconUser, IconTableAlias } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";

export default function ChatPage() {
  const { saas } = useParams();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  
  const isConnected = useQuery(
    api.databaseConfigs.isConnected,
    activeOrg?._id ? { organizationId: activeOrg._id } : "skip"
  );

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: { 
      organizationId: activeOrg?._id,
      slug: saas 
    },
  });

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
            Please head to the <b>Configure</b> section to link your MySQL or PostgreSQL source.
          </Text>
          <Button variant="outline" color="red" size="xs" component="a" href={`/${saas}/configure`}>
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
        style={{ flex: 1, overflow: "hidden", background: "rgba(255,255,255,0.01)", borderColor: "rgba(147,51,234,0.12)" }}
      >
        <ScrollArea h="100%" viewportRef={scrollRef} p="md">
          <Stack gap="lg">
            {messages.length === 0 && (
              <Box ta="center" py={50}>
                <Avatar size={60} radius="xl" color="violet" mx="auto" mb="md">
                  <IconRobot size={32} />
                </Avatar>
                <Text fw={600} size="lg" c="white">How can I help with your data today?</Text>
                <Text size="sm" c="dimmed">Ask me about your inventory, sales, or users.</Text>
              </Box>
            )}

            {messages.map((m: any) => (
              <Group key={m.id} align="flex-start" wrap="nowrap" justify={m.role === "user" ? "flex-end" : "flex-start"}>
                {m.role !== "user" && <Avatar size="sm" color="violet" radius="xl"><IconRobot size={16} /></Avatar>}

                <Paper
                  p="sm"
                  radius="md"
                  maw="90%"
                  style={{
                    background: m.role === "user" ? "rgba(147,51,234,0.2)" : "rgba(255,255,255,0.04)",
                    color: "white",
                    border: "1px solid",
                    borderColor: m.role === "user" ? "rgba(147,51,234,0.3)" : "rgba(255,255,255,0.1)"
                  }}
                >
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{m.content}</Text>
                  
                  {/* Result Table Rendering for Tool Results */}
                  {m.toolInvocations?.map((toolInvocation) => {
                    const { toolName, toolCallId, state } = toolInvocation;

                    if (state === 'result') {
                      const { result } = toolInvocation;
                      if (toolName === 'execute_sql' && result.success && result.data?.length > 0) {
                        return (
                          <Box key={toolCallId} mt="md" pt="md" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                            <Group gap="xs" mb="xs">
                               <IconTableAlias size={16} color="#a855f7" />
                               <Text size="xs" fw={700} color="violet.4">QUERY RESULTS</Text>
                            </Group>
                            <ScrollArea h={300} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px" }}>
                              <Table verticalSpacing="xs" striped highlightOnHover>
                                <Table.Thead style={{ background: "rgba(0,0,0,0.3)" }}>
                                  <Table.Tr>
                                    {Object.keys(result.data[0]).map((key) => (
                                      <Table.Th key={key} style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{key}</Table.Th>
                                    ))}
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {result.data.slice(0, 100).map((row: any, i: number) => (
                                    <Table.Tr key={i}>
                                      {Object.values(row).map((val: any, j: number) => (
                                        <Table.Td key={j} style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>{String(val)}</Table.Td>
                                      ))}
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                              {result.data.length > 100 && <Text size="10px" ta="center" py="xs" c="dimmed">Showing first 100 rows</Text>}
                            </ScrollArea>
                          </Box>
                        );
                      }
                      if (toolName === 'execute_sql' && !result.success) {
                        return (
                          <Box key={toolCallId} mt="md">
                             <Badge color="red" variant="light" size="xs">SQL ERROR</Badge>
                             <Text size="xs" color="red.5" mt={4} ff="monospace">{result.error}</Text>
                          </Box>
                        );
                      }
                    }
                    return null;
                  })}
                </Paper>

                {m.role === "user" && <Avatar size="sm" color="blue" radius="xl"><IconUser size={16} /></Avatar>}
              </Group>
            ))}

            {isLoading && (
              <Group gap="xs">
                <Avatar size="sm" color="violet" radius="xl"><IconRobot size={16} /></Avatar>
                <Loader size="xs" color="violet" type="dots" />
              </Group>
            ) }
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
