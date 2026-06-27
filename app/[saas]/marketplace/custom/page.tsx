"use client";

import { useState } from "react";
import {
  Box, Container, Title, Text, Grid, Card, Badge,
  Group, Button, Stack, ActionIcon, Tooltip, Modal, TextInput, Alert,
} from "@mantine/core";
import {
  IconTool,
  IconPlugConnected,
  IconCheck,
  IconTrash,
  IconInfoCircle,
  IconHistory,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function CustomToolsPage() {
  const { saas } = useParams();
  const { isSignedIn } = useUser();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const connectedKeys = useQuery(
    api.integrationKeys.listByOrganization,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  const [customMcpModal, setCustomMcpModal] = useState(false);
  const [customMcpName, setCustomMcpName] = useState("");
  const [customMcpUrl, setCustomMcpUrl] = useState("");
  const [customMcpToken, setCustomMcpToken] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  const customMcpServers = connectedKeys?.filter(k => k.integration.startsWith("custom_mcp__")) ?? [];

  const handleSaveCustomMcp = async () => {
    if (!customMcpName.trim() || !customMcpUrl.trim() || !activeOrg?._id) return;

    const integrationKey = `custom_mcp__${customMcpName.trim().toLowerCase().replace(/\s+/g, "_")}`;
    const alreadyExists = customMcpServers.some(k => k.integration === integrationKey);
    if (alreadyExists) {
      notifications.show({ title: "Name taken", message: `A custom MCP server named "${customMcpName}" already exists.`, color: "orange" });
      return;
    }

    setSavingCustom(true);
    try {
      const res = await fetch("/api/settings/integration-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrg._id,
          integration: integrationKey,
          keyType: "custom_mcp",
          keyValue: JSON.stringify({ url: customMcpUrl.trim(), token: customMcpToken.trim() }),
          mcpUrl: customMcpUrl.trim(),
          qualifiedName: `custom/${customMcpName.trim()}`,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      notifications.show({ title: "Custom MCP Added", message: `${customMcpName} is now available.`, color: "green" });
      setCustomMcpModal(false);
      setCustomMcpName(""); setCustomMcpUrl(""); setCustomMcpToken("");
    } catch (e: any) {
      notifications.show({ title: "Error", message: e.message, color: "red" });
    } finally {
      setSavingCustom(false);
    }
  };

  const handleRemoveCustomMcp = async (integration: string, displayName: string) => {
    if (!activeOrg?._id) return;
    try {
      const res = await fetch("/api/settings/integration-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: activeOrg._id, integration }),
      });
      if (!res.ok) throw new Error("Failed to remove server");
      notifications.show({ message: `${displayName} removed.`, color: "blue" });
    } catch (e: any) {
      notifications.show({ title: "Error", message: e.message, color: "red" });
    }
  };

  return (
    <Box p="xl" style={{ minHeight: "calc(100vh - 56px)" }}>
      <title>Custom Tools | Orcha</title>
      <Container size="xl">
        <Stack gap="xl" mb={40}>
          <Box>
            <Group gap="xs" mb={4}>
              <IconHistory size={16} color="var(--mantine-color-violet-4)" />
              <Text size="xs" fw={700} c="violet.4" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Tools & MCP</Text>
            </Group>
            <Group justify="space-between" align="center">
              <Box>
                <Title order={1} fw={800} size="h1" style={{ letterSpacing: "-0.02em" }}>Custom Tools</Title>
                <Text c="dimmed" size="sm" mt={4}>Bring your own MCP-compatible tool servers to Orcha Agent OS.</Text>
              </Box>
              <Button leftSection={<IconPlugConnected size={14} />} color="violet" variant="light" radius="md" onClick={() => setCustomMcpModal(true)}>
                Add Custom Server
              </Button>
            </Group>
          </Box>
        </Stack>

        {customMcpServers.length === 0 ? (
          <Box p="xl" style={{ border: "2px dashed var(--orcha-border)", borderRadius: 12, textAlign: "center", backgroundColor: "var(--orcha-surface)" }}>
            <IconTool size={48} color="rgba(147,51,234,0.3)" style={{ margin: "0 auto 16px" }} />
            <Text c="var(--orcha-text-title)" fw={600} size="lg">No custom tools yet</Text>
            <Text c="dimmed" size="sm" mt={4} maw={500} mx="auto">Any HTTP server that speaks JSON-RPC 2.0 MCP can be added. Your tools will be immediately available to the Orcha Agent.</Text>
            <Button mt="xl" variant="subtle" color="violet" onClick={() => setCustomMcpModal(true)}>Add your first server</Button>
          </Box>
        ) : (
          <Grid>
            {customMcpServers.map(k => {
              const displayName = k.integration.replace("custom_mcp__", "").replace(/_/g, " ");
              const serverUrl = k.mcpUrl ?? "";
              return (
                <Grid.Col key={k._id} span={{ base: 12, sm: 6, lg: 4 }}>
                  <Card 
                    component={Link}
                    href={`/${saas}/marketplace/custom/${k._id}`}
                    withBorder 
                    padding="lg" 
                    radius="md" 
                    style={{ 
                      backgroundColor: "var(--orcha-panel)", 
                      backdropFilter: "blur(10px)", 
                      borderColor: "var(--orcha-border)",
                      cursor: "pointer",
                      transition: "transform 0.2s ease, border-color 0.2s ease",
                    }}
                    className="hover:scale-[1.02] hover:border-[#a855f7]/50"
                  >
                    <Group justify="space-between" mb="sm">
                      <Group gap="sm">
                        <Box style={{ width: 40, height: 40, borderRadius: 10, background: "var(--orcha-sidebar-hover-bg)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--orcha-border)" }}>
                          <IconTool size={20} color="#a855f7" />
                        </Box>
                        <Box>
                          <Text fw={700} c="var(--orcha-text-title)" size="md" style={{ textTransform: "capitalize" }}>{displayName}</Text>
                          <Text size="xs" c="dimmed" truncate style={{ maxWidth: 200 }}>{serverUrl}</Text>
                        </Box>
                      </Group>
                      <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>Active</Badge>
                    </Group>
                    <Group justify="flex-end" mt="md">
                      <Button variant="subtle" color="red" size="xs" leftSection={<IconTrash size={12} />}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveCustomMcp(k.integration, displayName);
                        }}>
                        Remove Server
                      </Button>
                    </Group>
                  </Card>
                </Grid.Col>
              );
            })}
          </Grid>
        )}
      </Container>

      {/* Custom MCP Modal */}
      <Modal
        opened={customMcpModal}
        onClose={() => setCustomMcpModal(false)}
        title={<Group gap={8}><IconTool size={16} color="#a855f7" /><Text fw={600} c="var(--orcha-text-title)">Add Custom MCP Server</Text></Group>}
        radius="md"
        styles={{ content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" }, header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" } }}
      >
        <Stack gap="md" pt="xs">
          <Alert icon={<IconInfoCircle size={14} />} color="violet" variant="light" radius="md">
            <Text size="xs">Any server that implements the <b>MCP JSON-RPC 2.0</b> protocol over HTTP is supported.</Text>
          </Alert>
          <TextInput label="Server Name" placeholder="e.g. My Internal CRM" value={customMcpName} onChange={e => setCustomMcpName(e.target.value)} styles={{ input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white" }, label: { color: "rgba(255,255,255,0.6)", fontSize: 12 } }} />
          <TextInput label="MCP Server URL" placeholder="https://your-server.com/mcp" value={customMcpUrl} onChange={e => setCustomMcpUrl(e.target.value)} styles={{ input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white" }, label: { color: "rgba(255,255,255,0.6)", fontSize: 12 } }} />
          <TextInput label="Bearer Token (optional)" placeholder="Leave blank if no auth required" value={customMcpToken} onChange={e => setCustomMcpToken(e.target.value)} type="password" styles={{ input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white" }, label: { color: "rgba(255,255,255,0.6)", fontSize: 12 } }} />
          <Text size="11px" c="dimmed">The URL and token are encrypted and stored securely within your organization.</Text>
          <Group justify="flex-end" gap={8}>
            <Button variant="subtle" color="gray" onClick={() => setCustomMcpModal(false)}>Cancel</Button>
            <Button color="violet" loading={savingCustom} disabled={!customMcpName.trim() || !customMcpUrl.trim()} onClick={handleSaveCustomMcp}>Add Server</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
