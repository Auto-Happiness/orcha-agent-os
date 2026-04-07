import { Stack, Group, Avatar, Text, Box, Paper, Button, ScrollArea, Table, Loader } from "@mantine/core";
import { IconUser, IconSparkles, IconTableAlias, IconTableExport } from "@tabler/icons-react";
import { UIMessage } from "@ai-sdk/react";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  return (
    <>
      {messages.map((m: any) => (
        <Stack key={m.id} gap="md">
          <Group gap="md" align="flex-start" wrap="nowrap">
            <Avatar 
              size="md" 
              radius="xl" 
              color={m.role === "user" ? "blue" : "violet"}
              style={{ background: m.role === "user" ? "rgba(37,99,235,0.1)" : "transparent" }}
            >
              {m.role === "user" ? <IconUser size={20} /> : <IconSparkles size={24} style={{ color: "#a855f7" }} />}
            </Avatar>
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={700} size="sm" c="white">{m.role === "user" ? "You" : "Orcha Agent"}</Text>
              <Box>
                <Text size="md" c="rgba(255,255,255,0.9)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </Text>
              </Box>
            </Stack>
          </Group>

          {/* Tool Result Layout (Wren AI Style Table) */}
          {m.toolInvocations?.map((toolInvocation: any) => {
              const { toolName, toolCallId, state } = toolInvocation;
              if (state === 'result') {
                const { result } = toolInvocation;
                if (toolName === 'execute_sql' && result.success && result.data?.length > 0) {
                  return (
                    <Box key={toolCallId} ml="3rem" mt="sm">
                      <Paper withBorder radius="lg" p="md" style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(147,51,234,0.2)" }}>
                        <Group justify="space-between" mb="xs">
                          <Group gap={6}>
                             <IconTableAlias size={16} color="#a855f7" />
                             <Text size="xs" fw={700} c="violet.4">DATA OUTPUT</Text>
                          </Group>
                          <Button variant="subtle" size="compact-xs" color="dimmed" leftSection={<IconTableExport size={12} />}>Export CSV</Button>
                        </Group>
                        
                        <ScrollArea style={{ borderRadius: "8px" }}>
                          <Table verticalSpacing="xs" striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                {Object.keys(result.data[0]).map((key) => (
                                  <Table.Th key={key} style={{ fontSize: "11px", color: "rgba(255,255,234,0.4)", textTransform: "uppercase" }}>{key}</Table.Th>
                                ))}
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {result.data.slice(0, 10).map((row: any, i: number) => (
                                <Table.Tr key={i}>
                                  {Object.values(row).map((val: any, j: number) => (
                                    <Table.Td key={j} style={{ fontSize: "12px", color: "white" }}>{String(val)}</Table.Td>
                                  ))}
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </ScrollArea>
                        {result.data.length > 10 && <Text size="11px" ta="center" mt="xs" c="dimmed">Showing first 10 rows of {result.data.length}</Text>}
                      </Paper>
                    </Box>
                  );
                }
              }
              return null;
          })}
        </Stack>
      ))}

      {/* AI Thinking Animation */}
      {isLoading && (
        <Group gap="md" align="flex-start" wrap="nowrap">
          <Avatar size="md" radius="xl" color="violet" style={{ background: "transparent" }}>
            <IconSparkles size={24} style={{ color: "#a855f7" }} />
          </Avatar>
          <Stack gap={4} py={8}>
            <Text fw={700} size="sm" c="white">Orcha Agent</Text>
            <Loader size="xs" color="violet" type="dots" />
          </Stack>
        </Group>
      )}
    </>
  );
}
