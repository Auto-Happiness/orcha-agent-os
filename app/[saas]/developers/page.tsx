"use client";

import { useState } from "react";
import {
  Container,
  Title,
  Text,
  Paper,
  Tabs,
  Button,
  Table,
  Group,
  ActionIcon,
  Modal,
  TextInput,
  Stack,
  Box,
  Badge,
  Code,
  Tooltip,
  Center,
  Divider,
  SimpleGrid,
  Loader,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconKey,
  IconPlus,
  IconTrash,
  IconCopy,
  IconCheck,
  IconCode,
  IconActivity,
  IconSettings,
  IconArrowUpRight,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { KeySettingsDrawer } from "@/components/Developers/KeySettingsDrawer";
import { QuickIntegration } from "@/components/Developers/QuickIntegration";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from "recharts";

export default function DevelopersPage() {
  const params = useParams<{ saas: string }>();
  const slug = params?.saas ?? "";

  // ─── Data Fetching ──────────────────────────────────────────
  const orgDoc = useQuery(api.organizations.getSafeBySlug, { slug });
  const apiKeys = useQuery(api.apiKeys.list, orgDoc?._id ? { organizationId: orgDoc._id } : "skip");
  const settings = useQuery(api.developerSettings.get, orgDoc?._id ? { organizationId: orgDoc._id } : "skip");
  const telemetry = useQuery(api.apiKeys.getTelemetry, orgDoc?._id ? { organizationId: orgDoc._id } : "skip");

  // ─── Mutations ──────────────────────────────────────────────
  const createKey = useMutation(api.apiKeys.create);
  const deleteKey = useMutation(api.apiKeys.remove);
  const updateSettings = useMutation(api.developerSettings.update);

  const [opened, { open, close }] = useDisclosure(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [keyToConfigure, setKeyToConfigure] = useState<any>(null);
  const [keyToDelete, setKeyToDelete] = useState<any>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [copying, setCopying] = useState<string | null>(null);

  const handleCreateKey = async () => {
    if (!orgDoc?._id || !newKeyName) return;
    try {
      await createKey({ organizationId: orgDoc._id, name: newKeyName });
      notifications.show({
        title: "Key Created",
        message: "Your new API key has been generated.",
        color: "green",
      });
      setNewKeyName("");
      close();
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to create API key.",
        color: "red",
      });
    }
  };

  const handleDeleteClick = (key: any) => {
    setKeyToDelete(key);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;
    setIsDeleting(true);
    try {
      await deleteKey({ id: keyToDelete._id });
      notifications.show({
        title: "Key Revoked",
        message: "The API key has been permanently deleted.",
        color: "red",
      });
      setDeleteModalOpen(false);
      setKeyToDelete(null);
      setDeleteConfirmName("");
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to delete API key.",
        color: "red",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSettingsClick = (key: any) => {
    setKeyToConfigure(key);
    setSettingsOpened(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopying(text);
    setTimeout(() => setCopying(null), 2000);
    notifications.show({
      message: "API Key copied to clipboard",
      color: "violet",
      icon: <IconCheck size={16} />
    });
  };


  const handleUpdateSettings = async (updates: any) => {
    if (!orgDoc?._id || !settings) return;
    try {
      await updateSettings({
        organizationId: orgDoc._id,
        rateLimitPerMinute: updates.rateLimitPerMinute ?? settings.rateLimitPerMinute,
        isPublicApiEnabled: updates.isPublicApiEnabled ?? settings.isPublicApiEnabled,
      });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to update settings.",
        color: "red",
      });
    }
  };


  if (!orgDoc) return null;

  return (
    <Box
      p="xl"
      style={{
        minHeight: "calc(100vh - 56px)",
        background: "var(--orcha-surface)",
      }}
    >
      <Stack gap="xl">
          {/* ── Header Section ────────────────────────────────────────── */}
          <Box>
            <Group gap="xs" mb={4}>
              <IconCode size={16} color="var(--mantine-color-violet-4)" />
              <Text size="xs" fw={700} c="violet.4" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Developer Engine
              </Text>
            </Group>
            <Title order={1} fw={800} size="h1" c="var(--orcha-text-title)" style={{ letterSpacing: "-0.02em" }}>
              API & Integration
            </Title>
            <Text c="dimmed" size="sm" mt={4}>
              Build powerful workflows by integrating Orcha Agent OS into your existing tech stack.
            </Text>
          </Box>

          <Paper
            radius="xl"
            p={rem(32)}
            style={{
              background: "var(--orcha-panel)",
              border: "1px solid var(--orcha-border)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.05)",
            }}
          >
            <Tabs variant="pills" defaultValue="keys" color="violet" styles={{
              tab: {
                fontSize: rem(13),
                fontWeight: 600,
                padding: "10px 20px",
                borderRadius: "10px",
              },
              list: {
                marginBottom: rem(32),
                gap: rem(8),
              },
            }}>
              <Tabs.List>
                <Tabs.Tab value="keys" leftSection={<IconKey size={16} />}>API Keys</Tabs.Tab>
                <Tabs.Tab value="usage" leftSection={<IconActivity size={16} />}>Usage & Telemetry</Tabs.Tab>
              </Tabs.List>


              {/* ── API Keys Panel ────────────────────────────────────────── */}
              <Tabs.Panel value="keys">
                <Stack gap="xl">
                  <Group justify="space-between" align="flex-end">
                    <Box>
                      <Title order={3} c="var(--orcha-text-title)" fw={700}>Active API Keys</Title>
                      <Text size="sm" c="dimmed">Manage credentials for secure API access.</Text>
                    </Box>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      color="violet"
                      variant="filled"
                      radius="md"
                      onClick={open}
                    >
                      Generate New Key
                    </Button>
                  </Group>

                  <Paper withBorder radius="lg" style={{ background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", overflow: "hidden" }}>
                    <Table verticalSpacing="md">
                      <Table.Thead style={{ background: "var(--orcha-sidebar-hover-bg)" }}>
                        <Table.Tr style={{ borderBottom: "1px solid var(--orcha-border)" }}>
                          <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Key Name</Table.Th>
                          <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Secret Key</Table.Th>
                          <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Created</Table.Th>
                          <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Rate Limit</Table.Th>
                          <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Last Used</Table.Th>
                          <Table.Th style={{ padding: "16px" }} />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>

                        {apiKeys?.map((key) => (
                          <Table.Tr key={key._id} style={{ borderBottom: "1px solid var(--orcha-table-border)" }}>
                            <Table.Td fw={600} c="var(--orcha-text-title)">{key.name}</Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Code color="violet" px="md" py={4}>
                                  {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                                </Code>
                                <Tooltip label="Copy API Key" position="top">
                                  <ActionIcon
                                    variant="subtle"
                                    color="violet"
                                    size="sm"
                                    onClick={() => handleCopy(key.key)}
                                  >
                                    {copying === key.key ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">{new Date(key.createdAt).toLocaleDateString()}</Text>
                            </Table.Td>
                            <Table.Td>
                               <Badge variant="dot" color="violet" size="sm">
                                 {key.rateLimit || settings?.rateLimitPerMinute || 60} req/m
                               </Badge>
                             </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Group justify="flex-end" gap="xs">
                                <Tooltip label="Key Settings">
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => handleSettingsClick(key)}
                                  >
                                    <IconSettings size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Revoke Key" color="red">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleDeleteClick(key)}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        {apiKeys?.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={5}>
                              <Center py={40}>
                                <Stack align="center" gap="xs">
                                  <IconKey size={32} color="var(--orcha-border)" />
                                  <Text c="dimmed" size="sm">No API keys generated yet.</Text>
                                </Stack>
                              </Center>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Paper>

                  <Divider color="var(--orcha-border)" my="sm" />

                  <QuickIntegration organizationId={orgDoc._id} />
                </Stack>
              </Tabs.Panel>

        {/* ── Delete Confirmation Modal ────────────────────────────────── */}
        <Modal
          opened={deleteModalOpen}
          onClose={() => { setDeleteModalOpen(false); setDeleteConfirmName(""); }}
          title="Revoke API Key?"
          centered
          size="md"
          radius="lg"
          overlayProps={{
            color: "#05010d",
            opacity: 0.85,
            blur: 10,
          }}
          styles={{
            content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", padding: "1rem" },
            header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)", paddingBottom: "1rem" },
            title: { color: "var(--orcha-text-title)" }
          }}
        >
          <Stack gap="xl">
            <Box p="md" style={{ background: "rgba(255,0,0,0.05)", borderRadius: "8px", border: "1px solid rgba(255,0,0,0.1)" }}>
              <Stack gap="xs">
                <Text size="sm" c="red.4" fw={700}>This action cannot be undone.</Text>
                <Text size="xs" c="dimmed" lh={1.6}>
                  Revoking the key <b>{keyToDelete?.name}</b> will immediately disable all applications using it. 
                  Developers will receive a 401 Unauthorized error upon their next request.
                </Text>
              </Stack>
            </Box>

            <Stack gap={8}>
              <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: rem(1) }}>
                Confirm Key Name
              </Text>
              <TextInput
                placeholder={keyToDelete?.name}
                styles={{
                    input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                }}
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                autoFocus
              />
            </Stack>

            <Group justify="flex-end" gap="md">
              <Button variant="subtle" color="gray" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                color="red"
                variant="filled"
                loading={isDeleting}
                disabled={deleteConfirmName !== keyToDelete?.name}
                onClick={handleDeleteConfirm}
                leftSection={<IconTrash size={16} />}
                style={{ boxShadow: deleteConfirmName === keyToDelete?.name ? "0 0 20px rgba(239, 68, 68, 0.3)" : "none" }}
              >
                Revoke Permanently
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Tabs.Panel value="usage">
          {!telemetry ? (
            <Center py={100}>
              <Stack align="center" gap="md">
                <Loader color="violet" size="md" type="dots" />
                <Text size="sm" c="dimmed">Loading telemetry data...</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="xl">
              {/* ── Stats Cards Grid ── */}
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                {/* Total Requests Card */}
                <Paper
                  withBorder
                  radius="lg"
                  p="lg"
                  style={{
                    background: "var(--orcha-surface)",
                    borderColor: "var(--orcha-border)",
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Total API Requests
                    </Text>
                    <IconActivity size={18} color="var(--mantine-color-violet-4)" />
                  </Group>
                  <Group align="flex-end" gap="xs">
                    <Title order={2} fw={800} c="var(--orcha-text-title)">
                      {telemetry.totalRequests.toLocaleString()}
                    </Title>
                    <Badge color="green" variant="light" size="sm" leftSection={<IconArrowUpRight size={10} />}>
                      +4.2%
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    Combined across all keys (last 7 days)
                  </Text>
                </Paper>

                {/* Average Latency Card */}
                <Paper
                  withBorder
                  radius="lg"
                  p="lg"
                  style={{
                    background: "var(--orcha-surface)",
                    borderColor: "var(--orcha-border)",
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Avg Response Latency
                    </Text>
                    <IconSettings size={18} color="var(--mantine-color-blue-4)" />
                  </Group>
                  <Group align="flex-end" gap="xs">
                    <Title order={2} fw={800} c="var(--orcha-text-title)">
                      {telemetry.averageLatency}ms
                    </Title>
                    <Badge color="blue" variant="light" size="sm">
                      Optimal
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    Average server-side action execution
                  </Text>
                </Paper>

                {/* Success/Error Rate Card */}
                <Paper
                  withBorder
                  radius="lg"
                  p="lg"
                  style={{
                    background: "var(--orcha-surface)",
                    borderColor: "var(--orcha-border)",
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      API Success Rate
                    </Text>
                    <IconCheck size={18} color="var(--mantine-color-teal-4)" />
                  </Group>
                  <Group align="flex-end" gap="xs">
                    <Title order={2} fw={800} c="var(--orcha-text-title)">
                      {(100 - telemetry.errorRate).toFixed(2)}%
                    </Title>
                    <Badge color="red" variant="light" size="sm">
                      {telemetry.errorRate}% err
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    99.9% uptime target validation
                  </Text>
                </Paper>
              </SimpleGrid>

              {/* ── Chart Section ── */}
              <Paper
                withBorder
                radius="lg"
                p="xl"
                style={{
                  background: "var(--orcha-surface)",
                  borderColor: "var(--orcha-border)",
                }}
              >
                <Stack gap="md" mb="lg">
                  <Box>
                    <Title order={4} c="var(--orcha-text-title)" fw={700}>
                      API Volume Over Time
                    </Title>
                    <Text size="xs" c="dimmed">
                      Hourly requests and error distributions (past 7 days)
                    </Text>
                  </Box>
                </Stack>

                <Box style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={telemetry.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--mantine-color-violet-5)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--mantine-color-violet-5)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--mantine-color-red-5)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--mantine-color-red-5)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="name"
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        contentStyle={{
                          background: "var(--orcha-panel)",
                          borderColor: "var(--orcha-border)",
                          borderRadius: "12px",
                          color: "var(--orcha-text-title)",
                          fontSize: "12px",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="var(--mantine-color-violet-5)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRequests)"
                        name="Requests"
                      />
                      <Area
                        type="monotone"
                        dataKey="errors"
                        stroke="var(--mantine-color-red-5)"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#colorErrors)"
                        name="Errors"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>

              {/* ── Key Metrics Table ── */}
              <Paper
                withBorder
                radius="lg"
                style={{
                  background: "var(--orcha-surface)",
                  borderColor: "var(--orcha-border)",
                  overflow: "hidden",
                }}
              >
                <Box p="md" style={{ background: "var(--orcha-sidebar-hover-bg)", borderBottom: "1px solid var(--orcha-border)" }}>
                  <Title order={4} size="sm" c="var(--orcha-text-title)" fw={700}>
                    Key Performance Indicators (KPI)
                  </Title>
                </Box>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr style={{ borderBottom: "1px solid var(--orcha-border)" }}>
                      <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(10), fontWeight: 700, textTransform: "uppercase" }}>Key Name</Table.Th>
                      <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(10), fontWeight: 700, textTransform: "uppercase" }}>Total Requests (7d)</Table.Th>
                      <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(10), fontWeight: 700, textTransform: "uppercase" }}>Active (Last Min)</Table.Th>
                      <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(10), fontWeight: 700, textTransform: "uppercase" }}>Error Rate</Table.Th>
                      <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(10), fontWeight: 700, textTransform: "uppercase" }}>Avg Latency</Table.Th>
                      <Table.Th c="var(--orcha-text-muted)" style={{ fontSize: rem(10), fontWeight: 700, textTransform: "uppercase" }}>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {telemetry.keyMetrics.map((km) => (
                      <Table.Tr key={km.keyId} style={{ borderBottom: "1px solid var(--orcha-table-border)" }}>
                        <Table.Td fw={600} c="var(--orcha-text-title)">
                          {km.name}
                        </Table.Td>
                        <Table.Td c="var(--orcha-text-title)" style={{ fontSize: rem(13) }}>
                          {km.totalRequests.toLocaleString()}
                        </Table.Td>
                        <Table.Td>
                          {km.activeRequests > 0 ? (
                            <Badge color="green" variant="light" size="sm">
                              {km.activeRequests} req/m
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Idle
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ fontSize: rem(13) }}>
                          <Text c={km.errorRate > 1.0 ? "red.4" : "var(--orcha-text-title)"}>
                            {km.errorRate}%
                          </Text>
                        </Table.Td>
                        <Table.Td c="var(--orcha-text-title)" style={{ fontSize: rem(13) }}>
                          {km.avgLatency}ms
                        </Table.Td>
                        <Table.Td>
                          <Badge color="green" variant="dot" size="sm">
                            Active
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
          </Paper>
        </Stack>

        <KeySettingsDrawer
          opened={settingsOpened}
          onClose={() => setSettingsOpened(false)}
          apiKey={keyToConfigure}
        />

        <Modal
          opened={opened}
          onClose={close}
          title="Generate New API Key"
          centered
          size="sm"
          radius="lg"
          overlayProps={{
            color: "#05010d",
            opacity: 0.85,
            blur: 10,
          }}
          styles={{
            content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", padding: "1rem" },
            header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)", paddingBottom: "1rem" },
            title: { color: "var(--orcha-text-title)" }
          }}
        >
          <Stack>
            <TextInput
              label="Key Name"
              placeholder="e.g. Production Web App"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.currentTarget.value)}
              styles={{
                input: { background: "var(--orcha-surface)", border: "1px solid var(--orcha-border)", color: "var(--orcha-text-title)" },
                label: { color: "var(--orcha-text-title)", marginBottom: 4 }
              }}
            />
            <Text size="xs" c="dimmed">Give this key a unique name to identify it in your usage reports.</Text>
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={close}>Cancel</Button>
              <Button color="violet" onClick={handleCreateKey} disabled={!newKeyName}>Generate Key</Button>
            </Group>
          </Stack>
        </Modal>
    </Box>
  );
}
