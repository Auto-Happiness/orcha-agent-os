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
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { KeySettingsDrawer } from "@/components/Developers/KeySettingsDrawer";
import { QuickIntegration } from "@/components/Developers/QuickIntegration";

export default function DevelopersPage() {
  const params = useParams<{ saas: string }>();
  const slug = params?.saas ?? "";

  // ─── Data Fetching ──────────────────────────────────────────
  const orgDoc = useQuery(api.organizations.getSafeBySlug, { slug });
  const apiKeys = useQuery(api.apiKeys.list, orgDoc?._id ? { organizationId: orgDoc._id } : "skip");
  const settings = useQuery(api.developerSettings.get, orgDoc?._id ? { organizationId: orgDoc._id } : "skip");

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
        background: "radial-gradient(circle at top right, rgba(147,51,234,0.08) 0%, rgba(7,5,15,1) 50%)",
      }}
    >
      <Stack gap="xl">
          {/* ── Header Section ────────────────────────────────────────── */}
          <Box>
            <Group gap="xs" mb={4}>
              <Box
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "rgba(147,51,234,0.15)",
                  border: "1px solid rgba(147,51,234,0.3)",
                }}
              >
                <IconCode size={14} color="#a855f7" />
              </Box>
              <Text size="xs" fw={700} c="violet.4" style={{ letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Developer Engine
              </Text>
            </Group>
            <Title order={1} fw={900} size={rem(42)} c="white" style={{ letterSpacing: "-0.03em" }}>
              API & Integration
            </Title>
            <Text c="dimmed" size="lg" mt={4} maw={600}>
              Build powerful workflows by integrating Orcha Agent OS into your existing tech stack.
            </Text>
          </Box>

          <Paper
            radius="xl"
            p={rem(32)}
            style={{
              background: "rgba(19,15,34,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
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
                      <Title order={3} c="white" fw={700}>Active API Keys</Title>
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

                  <Paper withBorder radius="lg" style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <Table verticalSpacing="md">
                      <Table.Thead style={{ background: "rgba(255,255,255,0.02)" }}>
                        <Table.Tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <Table.Th c="dimmed" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Key Name</Table.Th>
                          <Table.Th c="dimmed" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Secret Key</Table.Th>
                          <Table.Th c="dimmed" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Created</Table.Th>
                          <Table.Th c="dimmed" style={{ fontSize: rem(11), fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "16px" }}>Last Used</Table.Th>
                          <Table.Th style={{ padding: "16px" }} />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>

                        {apiKeys?.map((key) => (
                          <Table.Tr key={key._id} style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                            <Table.Td fw={600} c="white">{key.name}</Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Code color="violet.9" c="violet.1" px="md" py={4}>
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
                                  <IconKey size={32} color="rgba(255,255,255,0.1)" />
                                  <Text c="dimmed" size="sm">No API keys generated yet.</Text>
                                </Stack>
                              </Center>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Paper>

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
            content: { background: "#0c0814", border: "1px solid rgba(255,0,0,0.2)", padding: "1rem" },
            header: { background: "#0c0814", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem" },
            title: { color: "white" }
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
                    input: { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "white" }
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
          <Center py={100}>
            <Stack align="center" gap="md">
              <Box style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(147,51,234,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(147,51,234,0.2)" }}>
                <IconActivity size={32} color="rgba(147,51,234,0.4)" />
              </Box>
              <Box style={{ textAlign: "center" }}>
                <Text fw={600} c="white">Usage Metrics Coming Soon</Text>
                <Text size="sm" c="dimmed" maw={400}>We are building a comprehensive dashboard to track your API consumption and performance in real-time.</Text>
              </Box>
            </Stack>
          </Center>
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
            content: { background: "#0c0814", border: "1px solid rgba(147,51,234,0.2)", padding: "1rem" },
            header: { background: "#0c0814", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem" },
            title: { color: "white" }
          }}
        >
          <Stack>
            <TextInput
              label="Key Name"
              placeholder="e.g. Production Web App"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.currentTarget.value)}
              styles={{
                input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white" },
                label: { color: "rgba(255,255,255,0.7)", marginBottom: 4 }
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
