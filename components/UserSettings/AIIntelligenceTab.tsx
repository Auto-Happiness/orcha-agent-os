"use client";

import { 
  Stack, 
  Paper, 
  Box, 
  Title, 
  Text, 
  Divider, 
  Group, 
  Avatar, 
  Badge, 
  TextInput, 
  Button,
  ActionIcon,
  Tooltip,
  Loader
} from "@mantine/core";
import { 
  IconPlus, 
  IconTrash, 
  IconExternalLink,
  IconCpu,
  IconCheck
} from "@tabler/icons-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { notifications } from "@mantine/notifications";
import { inputStyles } from "@/lib/styles";

type ProviderId = "gemini" | "openai" | "claude" | "local" | "grok";

interface ProviderDef {
  id: ProviderId;
  name: string;
  description: string;
  icon: string;
  keyLabel: string;
  placeholder: string;
}

const PROVIDERS: ProviderDef[] = [
  { 
    id: "gemini", 
    name: "Google Gemini", 
    description: "Multimodal power by Google. Default for Orcha Data Intelligence.",
    icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png",
    keyLabel: "Gemini API Key",
    placeholder: "AIzaSy..."
  },
  { 
    id: "openai", 
    name: "OpenAI", 
    description: "Industry leading GPT-4o and GPT-4o-mini models.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1200px-ChatGPT_logo.svg.png",
    keyLabel: "OpenAI API Key",
    placeholder: "sk-proj-..."
  },
  { 
    id: "claude", 
    name: "Anthropic Claude", 
    description: "World-class reasoning with Claude 3.5 Sonnet.",
    icon: "https://asset.brandfetch.io/idC-S_S_n1/idU_U-Y_Z_.png",
    keyLabel: "Claude API Key",
    placeholder: "sk-ant-api03-..."
  },
  { 
    id: "grok", 
    name: "xAI Grok", 
    description: "Real-time knowledge with Grok-1.",
    icon: "https://api.clerk.com/v1/proxy?url=https%3A%2F%2Fimg.clerk.com%2FeyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL3d3dy5nb2dsZS5jb20vczIvZmF2aWNvbnM/ZG9tYWluPWdyb2suY29tJnNpemU9MzIifQ",
    keyLabel: "xAI API Key",
    placeholder: "xai-..."
  },
  { 
    id: "local", 
    name: "Local Models (Ollama/vLLM)", 
    description: "Run your agents on local infrastructure (vLLM, Ollama, LM Studio).",
    icon: "https://ollama.com/public/ollama.png",
    keyLabel: "Base URL / Endpoint",
    placeholder: "http://localhost:11434/v1"
  }
];

interface AIIntelligenceTabProps {
  organization: any;
}

export function AIIntelligenceTab({ organization }: AIIntelligenceTabProps) {
  const { isSignedIn } = useUser();
  const existingKeys = useQuery(
    api.aiKeys.listByOrganization, 
    organization?._id && isSignedIn ? { organizationId: organization._id } : "skip"
  );
  
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [tempKey, setTempKey] = useState("");

  const handleConnect = async (provider: ProviderId) => {
    if (!organization?._id || !tempKey) return;
    
    setLoadingProvider(provider);
    try {
      const resp = await fetch("/api/settings/ai-keys", {
        method: "POST",
        body: JSON.stringify({
          organizationId: organization._id,
          provider,
          keyValue: tempKey
        })
      });

      if (!resp.ok) throw new Error("Failed to save key");
      
      notifications.show({
        title: "Connection Successful",
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} key has been stored securely.`,
        color: "green"
      });
      
      setEditingProvider(null);
      setTempKey("");
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDelete = async (provider: ProviderId) => {
    if (!organization?._id) return;
    
    try {
      await fetch("/api/settings/ai-keys", {
        method: "DELETE",
        body: JSON.stringify({ organizationId: organization._id, provider })
      });
      notifications.show({ message: `${provider} key removed.`, color: "blue" });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  return (
    <Paper withBorder p="2.5rem" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
      <Stack gap="xl">
        <Box>
          <Title order={3} size="1.5rem">AI Intelligence Providers</Title>
          <Text size="sm" c="dimmed">Configure the intelligence layers powering your agentic swarms.</Text>
        </Box>

        <Divider color="rgba(255,255,255,0.05)" />

        <Stack gap="lg">
          {PROVIDERS.map((p) => {
            const keyRecord = existingKeys?.find(k => k.provider === p.id);
            const isEditing = editingProvider === p.id;
            const isLoading = loadingProvider === p.id;

            return (
              <Paper 
                key={p.id} 
                withBorder 
                p="md" 
                radius="md" 
                style={{ 
                  background: keyRecord ? "rgba(147,51,234,0.02)" : "rgba(255,255,255,0.012)",
                  borderColor: keyRecord ? "rgba(147,51,234,0.2)" : "rgba(255,255,255,0.05)"
                }}
              >
                <Stack>
                  <Group justify="space-between">
                    <Group gap="md">
                      <Avatar size="sm" src={p.icon} radius="xs" />
                      <Box>
                        <Text size="sm" fw={700} c="white">{p.name}</Text>
                        <Text size="xs" c="dimmed">{p.description}</Text>
                      </Box>
                    </Group>
                    
                    {keyRecord ? (
                      <Group gap="xs">
                        <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={10} />}>CONNECTED</Badge>
                        <Tooltip label="Delete connection">
                           <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(p.id)}>
                             <IconTrash size={14} />
                           </ActionIcon>
                        </Tooltip>
                      </Group>
                    ) : (
                      !isEditing && <Button variant="light" color="violet" size="xs" radius="md" onClick={() => setEditingProvider(p.id)}>Connect</Button>
                    )}
                  </Group>

                  {isEditing && (
                    <Box mt="xs">
                       <TextInput 
                          label={p.keyLabel}
                          placeholder={p.placeholder}
                          value={tempKey}
                          onChange={(e) => setTempKey(e.currentTarget.value)}
                          type={p.id === 'local' ? 'text' : 'password'}
                          styles={inputStyles}
                       />
                       <Group justify="flex-end" mt="md" gap="xs">
                          <Button variant="subtle" color="gray" size="xs" onClick={() => { setEditingProvider(null); setTempKey(""); }}>Cancel</Button>
                          <Button 
                            color="violet" 
                            size="xs" 
                            radius="md" 
                            onClick={() => handleConnect(p.id)}
                            loading={isLoading}
                          >
                            Save Configuration
                          </Button>
                       </Group>
                    </Box>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}
