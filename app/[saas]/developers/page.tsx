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
  Switch,
  NumberInput,
  Stack,
  Box,
  Badge,
  Code,
  Tooltip,
  Divider,
  Center,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconKey,
  IconSettings,
  IconPlus,
  IconTrash,
  IconCopy,
  IconCheck,
  IconCode,
  IconActivity,
  IconExternalLink,
  IconBrandGolang,
  IconBrandPhp,
  IconBrandJavascript,
  IconBrandTypescript,
  IconBrandPython,
  IconTerminal2,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { notifications } from "@mantine/notifications";

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

  // ─── UI State ───────────────────────────────────────────────
  const [opened, { open, close }] = useDisclosure(false);
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

  const handleDeleteKey = async (id: any) => {
    try {
      await deleteKey({ id });
      notifications.show({
        title: "Key Deleted",
        message: "The API key has been removed.",
        color: "blue",
      });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to delete API key.",
        color: "red",
      });
    }
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

  // ─── Syntax Highlighting ────────────────────────────────────
  const HighlightCode = ({ code, lang }: { code: string; lang: string }) => {
    const highlighted = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"(.*?)"/g, '<span style="color: #ce9178">"$1"</span>') // strings
        .replace(/\b(func|package|import|var|public|class|static|void|using|await|new|return|curl|if|throws|throws|var|await|async|await|def|from|as|print|const|interface|type)\b/g, '<span style="color: #569cd6">$1</span>') // keywords
        .replace(/\b(http|client|req|resp|payload|messages|organizationId|ch|client|request|payload|response|URL|Header|Body|Main|requests|json|fetch|headers|method|body|reader|value)\b/g, '<span style="color: #9cdcfe">$1</span>') // variables
        .replace(/\b(POST|Authorization|Bearer|Content-Type)\b/g, '<span style="color: #4ec9b0">$1</span>'); // headers/methods

    return (
        <Code 
            block 
            p="md" 
            style={{ 
                background: "rgba(0,0,0,0.5)", 
                color: "#d4d4d4", 
                fontSize: rem(11), 
                fontFamily: "monospace",
                lineHeight: 1.6,
                border: "1px solid rgba(255,255,255,0.05)"
            }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
        />
    );
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
                <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>Settings</Tabs.Tab>
                <Tabs.Tab value="usage" leftSection={<IconActivity size={16} />}>Usage</Tabs.Tab>
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
                              <Group justify="flex-end">
                                <Tooltip label="Delete Key" color="red">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleDeleteKey(key._id)}
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

                  <Box>
                    <Group gap="xs" mb="sm">
                      <IconCode size={18} color="#a855f7" />
                      <Title order={4} c="white">Quick Integration</Title>
                    </Group>
                    <Paper
                      p="xl"
                      radius="lg"
                      style={{
                        background: "rgba(147,51,234,0.03)",
                        border: "1px solid rgba(147,51,234,0.15)",
                        position: "relative",
                        overflow: "hidden"
                      }}
                    >
                      <Box style={{
                        position: "absolute",
                        top: -50,
                        right: -50,
                        width: 150,
                        height: 150,
                        background: "radial-gradient(circle, rgba(147,51,234,0.2) 0%, transparent 70%)",
                        filter: "blur(20px)"
                      }} />

                      <Stack gap="md">
                        <Box>
                          <Text size="sm" fw={600} c="white" mb={4}>Streaming API (SSE)</Text>
                          <Text size="xs" c="dimmed" lh={1.5}>
                            This endpoint uses <strong>Server-Sent Events (SSE)</strong> to stream responses 
                            in real-time chunks, allowing your application to display 
                            the agent's response as it is being generated.
                          </Text>
                        </Box>

                        <Text size="sm" c="dimmed">Select your language to see integration examples:</Text>
                        
                        <Tabs variant="outline" defaultValue="curl" styles={{
                            tab: { fontSize: rem(11), padding: "6px 16px", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" },
                            list: { borderBottom: "none", marginBottom: rem(12), gap: rem(8) }
                        }}>
                          <Tabs.List>
                            <Tabs.Tab value="curl" leftSection={<IconTerminal2 size={14} />}>cURL</Tabs.Tab>
                            <Tabs.Tab value="js" leftSection={<IconBrandJavascript size={14} color="#F7DF1E" />}>JavaScript</Tabs.Tab>
                            <Tabs.Tab value="ts" leftSection={<IconBrandTypescript size={14} color="#3178C6" />}>TypeScript</Tabs.Tab>
                            <Tabs.Tab value="python" leftSection={<IconBrandPython size={14} color="#3776AB" />}>Python</Tabs.Tab>
                            <Tabs.Tab value="go" leftSection={<IconBrandGolang size={14} color="#00ADD8" />}>Golang</Tabs.Tab>
                            <Tabs.Tab value="java" leftSection={<IconCode size={14} color="#E76F00" />}>Java</Tabs.Tab>
                            <Tabs.Tab value="php" leftSection={<IconBrandPhp size={14} color="#777BB4" />}>PHP</Tabs.Tab>
                          </Tabs.List>

                          <Tabs.Panel value="curl">
                            <HighlightCode 
                              lang="bash"
                              code={`curl -X POST https://api.orcha-agent.com/api/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "${orgDoc._id}",
    "messages": [{"role": "user", "content": "Hello Agent"}]
  }'`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="js">
                            <HighlightCode 
                              lang="javascript"
                              code={`const response = await fetch("https://api.orcha-agent.com/api/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    organizationId: "${orgDoc._id}",
    messages: [{ role: "user", content: "Hello Agent" }]
  })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="ts">
                            <HighlightCode 
                              lang="typescript"
                              code={`interface ChatRequest {
  organizationId: string;
  messages: Array<{ role: string; content: string }>;
}

const req: ChatRequest = {
  organizationId: "${orgDoc._id}",
  messages: [{ role: "user", content: "Hello Agent" }]
};

const response = await fetch("https://api.orcha-agent.com/api/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(req)
});`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="python">
                            <HighlightCode 
                              lang="python"
                              code={`import requests
import json

url = "https://api.orcha-agent.com/api/chat"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "organizationId": "${orgDoc._id}",
    "messages": [{"role": "user", "content": "Hello Agent"}]
}

response = requests.post(url, headers=headers, json=payload, stream=True)

for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="go">
                            <HighlightCode 
                              lang="go"
                              code={`package main

import (
	"bytes"
	"encoding/json"
	"net/http"
)

func main() {
	url := "https://api.orcha-agent.com/api/chat"
	payload := map[string]interface{}{
		"organizationId": "${orgDoc._id}",
		"messages": []map[string]string{
			{"role": "user", "content": "Hello Agent"},
		},
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	client.Do(req)
}`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="java">
                            <HighlightCode 
                              lang="java"
                              code={`import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Main {
    public static void main(String[] args) throws Exception {
        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.orcha-agent.com/api/chat"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\\"organizationId\\":\\"${orgDoc._id}\\", \\"messages\\":[{\\"role\\":\\"user\\", \\"content\\":\\"Hello Agent\\"}]}"))
            .build();

        client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="csharp">
                            <HighlightCode 
                              lang="csharp"
                              code={`using System.Net.Http.Json;

using var client = new HttpClient();
client.DefaultRequestHeaders.Add("Authorization", "Bearer YOUR_API_KEY");

var payload = new {
    organizationId = "${orgDoc._id}",
    messages = new[] { new { role = "user", content = "Hello Agent" } }
};

await client.PostAsJsonAsync("https://api.orcha-agent.com/api/chat", payload);`}
                            />
                          </Tabs.Panel>

                          <Tabs.Panel value="php">
                            <HighlightCode 
                              lang="php"
                              code={`<?php
$ch = curl_init("https://api.orcha-agent.com/api/chat");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "organizationId" => "${orgDoc._id}",
    "messages" => [["role" => "user", "content" => "Hello Agent"]]
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer YOUR_API_KEY",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
curl_close($ch);`}
                            />
                          </Tabs.Panel>
                        </Tabs>

                        <Button
                          variant="subtle"
                          color="violet"
                          size="xs"
                          rightSection={<IconExternalLink size={14} />}
                          component="a"
                          href="#"
                          style={{ alignSelf: "flex-start" }}
                        >
                          Read Full API Documentation
                        </Button>
                      </Stack>
                    </Paper>
                  </Box>
                </Stack>
              </Tabs.Panel>

              {/* ── Settings Panel ────────────────────────────────────────── */}
              <Tabs.Panel value="settings">
                <Stack gap="xl">
                  <Box>
                    <Title order={3} c="white" fw={700}>API Configuration</Title>
                    <Text size="sm" c="dimmed">Global settings for your organization's API access.</Text>
                  </Box>

                  <Stack gap="lg" style={{ maxWidth: 600 }}>
                    <Paper p="lg" radius="md" withBorder style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }}>
                      <Group justify="space-between">
                        <Box>
                          <Text fw={600} c="white">Public API Access</Text>
                          <Text size="xs" c="dimmed">Enable or disable API access for the entire organization.</Text>
                        </Box>
                        <Switch
                          color="violet"
                          size="md"
                          checked={settings?.isPublicApiEnabled ?? true}
                          onChange={(e) => handleUpdateSettings({ isPublicApiEnabled: e.currentTarget.checked })}
                        />
                      </Group>
                    </Paper>

                    <Paper p="lg" radius="md" withBorder style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }}>
                      <Stack gap="md">
                        <Group justify="space-between">
                          <Box>
                            <Text fw={600} c="white">Rate Limiting</Text>
                            <Text size="xs" c="dimmed">Requests allowed per minute per API key.</Text>
                          </Box>
                          <NumberInput
                            size="sm"
                            w={100}
                            min={1}
                            max={5000}
                            value={settings?.rateLimitPerMinute ?? 60}
                            onChange={(val) => handleUpdateSettings({ rateLimitPerMinute: val })}
                            styles={{ input: { background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.1)", color: "white" } }}
                          />
                        </Group>
                        <Divider color="rgba(255,255,255,0.05)" />
                        <Box>
                          <Badge color="violet" variant="light" mb={4}>Organization Tier: Enterprise</Badge>
                          <Text size="xs" c="dimmed">Your current tier allows up to 5,000 requests per minute.</Text>
                        </Box>
                      </Stack>
                    </Paper>
                  </Stack>
                </Stack>
              </Tabs.Panel>

              {/* ── Usage Panel ───────────────────────────────────────────── */}
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

        {/* ── Modals ────────────────────────────────────────────────── */}
        <Modal
          opened={opened}
          onClose={close}
          title="Generate API Key"
          centered
          radius="md"
          styles={{
            content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" },
            header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" },
            title: { fontWeight: 700, color: "white" }
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
