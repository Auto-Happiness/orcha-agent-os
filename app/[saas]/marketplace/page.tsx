"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box, Container, Title, Text, Grid, Card, Badge,
  Group, Button, Stack, ActionIcon, Tooltip, Modal, TextInput, Select, Alert,
} from "@mantine/core";
import {
  IconExternalLink,
  IconDownload,
  IconPlugConnected,
  IconHistory,
  IconCheck,
  IconTrash,
  IconLock,
  IconInfoCircle,
  IconBolt,
  IconTool,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { getMcpServer } from "@/lib/mcp-registry";

const INTEGRATIONS = [
  /* Temporarily hidden
  {
    name: "Slack",
    description: "Send messages, read channels and trigger workflows inside your Slack workspace.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
    category: "Communication",
    homepage: "https://slack.com",
    toolCount: 6,
    toolList: ["Send message", "List channels", "Read messages", "Search messages", "Get channel info", "List users"],
  },
  {
    name: "Airtable",
    description: "Connect your Airtable bases to query and sync structured data with your AI agents.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg",
    category: "Database",
    homepage: "https://airtable.com",
    toolCount: 5,
    toolList: ["List bases", "List tables", "Get records", "Create record", "Update record"],
  },
  {
    name: "Confluence",
    description: "Search, read and create Confluence pages and spaces from your agent pipelines.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Confluence_logo.svg/240px-Confluence_logo.svg.png",
    category: "Knowledge",
    homepage: "https://www.atlassian.com/software/confluence",
    toolCount: 4,
    toolList: ["Search pages", "Get page content", "Create page", "Update page"],
  },
  */
  {
    name: "Gmail",
    description: "Access, search and compose Gmail messages and threads from your agent.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg",
    category: "Email",
    homepage: "https://mail.google.com",
    toolCount: 4,
    toolList: ["List emails", "Read email", "Send email", "Create draft"],
  },
  {
    name: "Google Sheets",
    description: "Read, write and create Google Sheets spreadsheets — perfect for reporting and data pipelines.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg",
    category: "Productivity",
    homepage: "https://sheets.google.com",
    toolCount: 6,
    toolList: ["List spreadsheets", "Read range", "Write range", "Append rows", "Get metadata", "Create spreadsheet"],
  },
  {
    name: "Google Drive",
    description: "Browse, search, read and manage files stored in Google Drive from your agents.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
    category: "Storage",
    homepage: "https://drive.google.com",
    toolCount: 5,
    toolList: ["Search files", "Get file", "List folder", "Read file content", "Move file"],
  },
  {
    name: "Google Calendar",
    description: "Create, update and send Google Calendar invites with Meet links, reminders and attendees.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg",
    category: "Productivity",
    homepage: "https://calendar.google.com",
    toolCount: 5,
    toolList: ["List events", "Get event", "Create event + invite", "Update event", "Delete event"],
  },
  // Coming soon: Outlook, Microsoft Teams, Excel, SharePoint, Databox (OAuth not yet configured)
];

const CATEGORY_COLORS: Record<string, string> = {
  Database: "blue", Productivity: "violet", Analytics: "green",
  Email: "orange", Communication: "cyan", Storage: "grape", Knowledge: "yellow",
};

type ModalState = {
  registryKey: string;
  name: string;
  credentialType: "bearer" | "config_json" | "oauth";
  configFields?: { key: string; label: string; placeholder: string; type?: string }[];
  keyLabel?: string;
  keyPlaceholder?: string;
} | null;

export default function MarketplacePage() {
  const { saas } = useParams();
  const { isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const connectedKeys = useQuery(
    api.integrationKeys.listByOrganization,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  // Handle cross-window messages from OAuth popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Security check: ensure the message is from our own origin
      if (event.origin !== window.location.origin) return;

      const { type, success, integration, error } = event.data;
      if (type === "GOOGLE_OAUTH_RESULT") {
        if (success) {
          notifications.show({ 
            title: "Connected!", 
            message: `${integration.replace(/_/g, " ")} connected via Google OAuth.`, 
            color: "green" 
          });
        } else {
          const messages: Record<string, string> = {
            oauth_denied: "You cancelled the Google sign-in.",
            token_exchange_failed: "Google token exchange failed. Please try again.",
            server_error: "An unexpected error occurred.",
          };
          notifications.show({ title: "OAuth Error", message: messages[error] || error, color: "red" });
        }
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  const [modal, setModal] = useState<ModalState>(null);
  const [keyValue, setKeyValue] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customMcpModal, setCustomMcpModal] = useState(false);
  const [customMcpName, setCustomMcpName] = useState("");
  const [customMcpUrl, setCustomMcpUrl] = useState("");
  const [customMcpToken, setCustomMcpToken] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  const registryKey = (name: string) => name.toLowerCase().replace(/\s+/g, "_");
  const getRegistryConfig = (name: string) => getMcpServer(registryKey(name));

  const openModal = (item: typeof INTEGRATIONS[0]) => {
    const reg = getRegistryConfig(item.name);
    const rKey = registryKey(item.name);
    if (!reg) return;

    setConfigValues({});
    setKeyValue("");

    if (reg.credentialType === "oauth_google") {
      if (!activeOrg?._id) return;
      const url = `/api/auth/google?integration=${rKey}&orgId=${activeOrg._id}&slug=${saas}`;
      
      // Open centered popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(url, "GoogleLogin", `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,toolbar=no,menubar=no,location=no`);
      return;
    }

    if (reg.credentialType === "oauth") {
      setModal({ registryKey: rKey, name: item.name, credentialType: "oauth" });
      return;
    }

    if (reg.credentialType === "config_json") {
      setModal({
        registryKey: rKey,
        name: item.name,
        credentialType: "config_json",
        configFields: reg.configFields,
      });
      return;
    }

    setModal({
      registryKey: rKey,
      name: item.name,
      credentialType: "bearer",
      keyLabel: reg.authHeader?.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || "API Key",
      keyPlaceholder: item.name === "Slack" ? "xoxb-..." : item.name === "Airtable" ? "pat..." : "ya29...",
    });
  };

  const isConnected = (name: string) =>
    connectedKeys?.some(k => k.integration === registryKey(name));

  const handleSave = async () => {
    if (!modal || !activeOrg?._id) return;
    setSaving(true);

    let finalValue = "";
    if (modal.credentialType === "bearer") {
      if (!keyValue.trim()) { setSaving(false); return; }
      finalValue = keyValue.trim();
    } else if (modal.credentialType === "config_json") {
      const allFilled = modal.configFields?.every(f => configValues[f.key]?.trim());
      if (!allFilled) { setSaving(false); return; }
      finalValue = JSON.stringify(configValues);
    }

    try {
      const res = await fetch("/api/settings/integration-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrg._id,
          integration: modal.registryKey,
          keyType: modal.credentialType,
          keyValue: finalValue,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      notifications.show({ title: "Connected", message: `${modal.name} integration saved.`, color: "green" });
      setModal(null);
    } catch (e: any) {
      notifications.show({ title: "Error", message: e.message, color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (name: string) => {
    if (!activeOrg?._id) return;
    await fetch("/api/settings/integration-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: activeOrg._id, integration: registryKey(name) }),
    });
    notifications.show({ message: `${name} disconnected.`, color: "blue" });
  };

  const handleSaveCustomMcp = async () => {
    if (!customMcpName.trim() || !customMcpUrl.trim() || !activeOrg?._id) return;

    // Prevent duplicate names
    const integrationKey = `custom_mcp__${customMcpName.trim().toLowerCase().replace(/\s+/g, "_")}`;
    const alreadyExists = customMcpServers.some(k => k.integration === integrationKey);
    if (alreadyExists) {
      notifications.show({ title: "Name taken", message: `A custom MCP server named "${customMcpName}" already exists. Use a different name.`, color: "orange" });
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
      notifications.show({ title: "Custom MCP Added", message: `${customMcpName} is now available as a tool server.`, color: "green" });
      setCustomMcpModal(false);
      setCustomMcpName(""); setCustomMcpUrl(""); setCustomMcpToken("");
    } catch (e: any) {
      notifications.show({ title: "Error", message: e.message, color: "red" });
    } finally {
      setSavingCustom(false);
    }
  };

  const customMcpServers = connectedKeys?.filter(k => k.integration.startsWith("custom_mcp__")) ?? [];

  return (
    <Box p="xl" style={{ minHeight: "calc(100vh - 56px)" }}>
      <title>Market Place</title>
      <Container size="xl">
        <Stack gap="xl" mb={40}>
          <Box>
            <Group gap="xs" mb={4}>
              <IconHistory size={16} color="var(--mantine-color-violet-4)" />
              <Text size="xs" fw={700} c="violet.4" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Hub & Marketplace</Text>
            </Group>
            <Title order={1} fw={800} size="h1" style={{ letterSpacing: "-0.02em" }}>Integrations</Title>
            <Text c="dimmed" size="sm" mt={4}>Connect your favourite tools to Orcha Agent OS.</Text>
          </Box>
        </Stack>

        <Grid>
          {INTEGRATIONS.map((item) => {
            const connected = isConnected(item.name);
            const reg = getRegistryConfig(item.name);
            const isOAuth = reg?.credentialType === "oauth";
            return (
              <Grid.Col key={item.name} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card withBorder padding="lg" radius="md" style={{ backgroundColor: "rgba(19,15,34,0.4)", backdropFilter: "blur(10px)", borderColor: connected ? "rgba(34,197,94,0.25)" : "rgba(147,51,234,0.12)", height: "100%", display: "flex", flexDirection: "column" }}>
                  <Card.Section p="md" style={{ borderBottom: "1px solid rgba(147,51,234,0.08)" }}>
                    <Group justify="space-between" align="center">
                      <Group gap="md">
                        <Box style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid rgba(147,51,234,0.15)", padding: 8 }}>
                          <img src={item.icon} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </Box>
                        <Box>
                          <Text fw={700} size="md" c="white">{item.name}</Text>
                          <Group gap={4}>
                            <Badge variant="light" color={CATEGORY_COLORS[item.category] ?? "violet"} size="xs" radius="sm">{item.category}</Badge>
                            {isOAuth && <Badge variant="outline" color="orange" size="xs" radius="sm" leftSection={<IconLock size={9} />}>OAuth</Badge>}
                            {reg?.credentialType === "oauth_google" && <Badge variant="outline" color="blue" size="xs" radius="sm">Google</Badge>}
                          </Group>
                        </Box>
                      </Group>
                      <Group gap={4}>
                        <Badge variant="filled" color="teal.8" size="xs" radius="sm" leftSection={<IconBolt size={10} />}>Live</Badge>
                        <Tooltip 
                          label={
                            <Stack gap={4} p={4}>
                              <Text fw={700} size="xs">Available Tools ({item.toolCount}):</Text>
                              {item.toolList?.map(t => <Text key={t} size="xs">• {t}</Text>)}
                            </Stack>
                          } 
                          withArrow 
                          position="bottom"
                        >
                          <Badge variant="light" color="violet" size="xs" radius="sm" style={{ cursor: 'help' }}>
                            {item.toolCount} Tools
                          </Badge>
                        </Tooltip>
                        {connected && <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>Connected</Badge>}
                        <Tooltip label="Learn more" withArrow>
                          <ActionIcon component="a" href={item.homepage} target="_blank" variant="subtle" color="gray" size="sm">
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Card.Section>
                  <Stack gap="md" mt="md" style={{ flex: 1 }} justify="space-between">
                    <Text size="sm" c="dimmed" lineClamp={3} style={{ lineHeight: 1.5 }}>{item.description}</Text>
                    <Group justify="flex-end" gap={6}>
                      {connected ? (
                        <Button variant="subtle" color="red" size="xs" leftSection={<IconTrash size={12} />} onClick={() => handleDisconnect(item.name)}>Disconnect</Button>
                      ) : (reg?.credentialType === "oauth_google") ? (
                        <Button
                          variant="light" color="blue"
                          size="xs"
                          leftSection={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={14} height={14} alt="Google" />}
                          onClick={() => openModal(item)}
                          styles={{ root: { backgroundColor: "rgba(66,133,244,0.1)" } }}
                        >
                          Sign in with Google
                        </Button>
                      ) : (
                        <Button
                          variant="light" color={isOAuth ? "orange" : "violet"}
                          leftSection={isOAuth ? <IconLock size={14} /> : <IconDownload size={14} />}
                          size="xs"
                          onClick={() => openModal(item)}
                          styles={{ root: { backgroundColor: isOAuth ? "rgba(251,146,60,0.1)" : "rgba(147,51,234,0.1)" } }}
                        >
                          {isOAuth ? "Setup" : "Connect"}
                        </Button>
                      )}
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            );
          })}
        </Grid>
      </Container>

      {/* ── Custom MCP Servers ─────────────────────────────────────────────── */}
      <Container size="xl" mt={60}>
        <Group justify="space-between" align="center" mb="lg">
          <Box>
            <Group gap="xs" mb={4}>
              <IconTool size={16} color="#a855f7" />
              <Text size="xs" fw={700} c="violet.4" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Custom MCP Servers</Text>
            </Group>
            <Text c="white" fw={600} size="lg">Bring Your Own MCP</Text>
            <Text c="dimmed" size="sm">Connect any MCP-compatible server — self-hosted, private, or third-party.</Text>
          </Box>
          <Button leftSection={<IconPlugConnected size={14} />} color="violet" variant="light" radius="md" onClick={() => setCustomMcpModal(true)}>
            Add Custom Server
          </Button>
        </Group>

        {customMcpServers.length === 0 ? (
          <Box p="xl" style={{ border: "2px dashed rgba(147,51,234,0.15)", borderRadius: 12, textAlign: "center" }}>
            <IconTool size={32} color="rgba(147,51,234,0.3)" style={{ margin: "0 auto 12px" }} />
            <Text c="dimmed" size="sm">No custom MCP servers yet.</Text>
            <Text c="dimmed" size="xs" mt={4}>Any HTTP server that speaks JSON-RPC 2.0 MCP can be added here.</Text>
          </Box>
        ) : (
          <Grid>
            {customMcpServers.map(k => {
              const displayName = k.integration.replace("custom_mcp__", "").replace(/_/g, " ");
              const serverUrl = k.mcpUrl ?? "";
              return (
                <Grid.Col key={k._id} span={{ base: 12, sm: 6, lg: 4 }}>
                  <Card withBorder padding="lg" radius="md" style={{ backgroundColor: "rgba(19,15,34,0.4)", borderColor: "rgba(34,197,94,0.2)" }}>
                    <Group justify="space-between" mb="sm">
                      <Group gap="sm">
                        <Box style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(147,51,234,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <IconTool size={18} color="#a855f7" />
                        </Box>
                        <Box>
                          <Text fw={600} c="white" size="sm" style={{ textTransform: "capitalize" }}>{displayName}</Text>
                          <Text size="10px" c="dimmed" truncate style={{ maxWidth: 180 }}>{serverUrl}</Text>
                        </Box>
                      </Group>
                      <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>Active</Badge>
                    </Group>
                    <Group justify="flex-end">
                      <Button variant="subtle" color="red" size="xs" leftSection={<IconTrash size={12} />}
                        onClick={async () => {
                          if (!activeOrg?._id) return;
                          await fetch("/api/settings/integration-keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: activeOrg._id, integration: k.integration }) });
                          notifications.show({ message: `${displayName} removed.`, color: "blue" });
                        }}>
                        Remove
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
        title={<Group gap={8}><IconTool size={16} color="#a855f7" /><Text fw={600} c="white">Add Custom MCP Server</Text></Group>}
        radius="md"
        styles={{ content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" }, header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" } }}
      >
        <Stack gap="md" pt="xs">
          <Alert icon={<IconInfoCircle size={14} />} color="violet" variant="light" radius="md">
            <Text size="xs">Any server that implements the <b>MCP JSON-RPC 2.0</b> protocol over HTTP is supported — Smithery-hosted, self-hosted, or third-party.</Text>
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

      {/* Integration connect modal */}
      <Modal
        opened={!!modal}
        onClose={() => setModal(null)}
        title={<Group gap={8}><IconPlugConnected size={16} color="#a855f7" /><Text fw={600} c="white">Connect {modal?.name}</Text></Group>}
        radius="md"
        styles={{ content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" }, header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" } }}
      >
        <Stack gap="md" pt="xs">
          {modal?.credentialType === "oauth" && (
            <>
              <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light" radius="md">
                <Text size="sm" fw={600} mb={4}>OAuth Flow Required</Text>
                <Text size="xs" c="dimmed">
                  {modal.name} uses OAuth 2.0 and cannot be connected with a simple API key.
                </Text>
              </Alert>
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setModal(null)}>Close</Button>
              </Group>
            </>
          )}

          {modal?.credentialType === "bearer" && (
            <>
              <TextInput
                label={modal.keyLabel}
                placeholder={modal.keyPlaceholder}
                value={keyValue}
                onChange={e => setKeyValue(e.target.value)}
                type="password"
                styles={{ input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white" }, label: { color: "rgba(255,255,255,0.6)", fontSize: 12 } }}
              />
              <Text size="11px" c="dimmed">Stored encrypted and bound to your organization.</Text>
              <Group justify="flex-end" gap={8}>
                <Button variant="subtle" color="gray" onClick={() => setModal(null)}>Cancel</Button>
                <Button color="violet" loading={saving} disabled={!keyValue.trim()} onClick={handleSave}>Save & Connect</Button>
              </Group>
            </>
          )}

          {modal?.credentialType === "config_json" && (
            <>
              {modal.configFields?.map(field => (
                <TextInput
                  key={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  value={configValues[field.key] || ""}
                  onChange={e => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  type={field.type === "password" ? "password" : "text"}
                  styles={{ input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white" }, label: { color: "rgba(255,255,255,0.6)", fontSize: 12 } }}
                />
              ))}
              <Text size="11px" c="dimmed">All fields are encrypted and stored securely within your organization.</Text>
              <Group justify="flex-end" gap={8}>
                <Button variant="subtle" color="gray" onClick={() => setModal(null)}>Cancel</Button>
                <Button
                  color="violet" loading={saving}
                  disabled={!modal.configFields?.every(f => configValues[f.key]?.trim())}
                  onClick={handleSave}
                >
                  Save & Connect
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}
