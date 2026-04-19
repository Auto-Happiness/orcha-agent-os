import { 
  Paper, 
  Stack, 
  Group, 
  Text, 
  ThemeIcon, 
  Badge, 
  Divider, 
  Grid,
  rem,
  Box,
  Alert,
  Title
} from "@mantine/core";
import { 
  IconBrain, 
  IconCircleCheck, 
  IconAlertTriangle, 
  IconBrandGoogle, 
  IconBrandOpenai, 
  IconCpu,
  IconFingerprint,
  IconVariable,
  IconMaximize
} from "@tabler/icons-react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

interface MemoryStatusProps {
  currentConfig: any;
  activeOrgId: any;
}

const PROVIDER_METADATA: Record<string, any> = {
  gemini: {
    name: "Google Gemini",
    icon: IconBrandGoogle,
    color: "blue",
    dimensions: 768,
    description: "Multi-modal reasoning engine optimized for balanced performance and retrieval accuracy."
  },
  openai: {
    name: "OpenAI Text-003",
    icon: IconBrandOpenai,
    color: "green",
    dimensions: 1536,
    description: "High-resolution embedding series with superior cross-domain semantic understanding."
  },
  local: {
    name: "Orcha Local/Ollama",
    icon: IconCpu,
    color: "orange",
    dimensions: 1024,
    description: "Zero-latency private embeddings processed entirely within your infrastructure."
  }
};

export function MemoryStatus({ currentConfig, activeOrgId }: MemoryStatusProps) {
  const { isAuthenticated } = useConvexAuth();
  const providerKey = currentConfig.memoryProvider || "gemini";
  const metadata = PROVIDER_METADATA[providerKey] || PROVIDER_METADATA.gemini;
  const Icon = metadata.icon;

  const aiKeys = useQuery(api.aiKeys.listByOrganization, (isAuthenticated && activeOrgId) ? { organizationId: activeOrgId } : "skip");
  
  const hasKey = aiKeys?.some(k => k.provider === providerKey) || providerKey === "local";

  return (
    <Stack gap="xl">
      <Box>
        <Title order={3} size="h3" c="white" mb={4}>Semantic Memory System</Title>
        <Text size="xs" c="dimmed">Current configuration for the RAG indexing and vector retrieval engine.</Text>
      </Box>

      <Grid gutter="xl">
        <Grid.Col span={8}>
          <Paper withBorder p="2.5rem" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
            <Stack gap="xl">
              <Group justify="space-between" align="flex-start">
                <Group gap="md">
                  <ThemeIcon 
                    size={54} 
                    radius="md" 
                    variant="light" 
                    color={metadata.color}
                    style={{ background: `rgba(var(--mantine-color-${metadata.color}-6-raw), 0.1)` }}
                  >
                    <Icon size={32} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xl" fw={800} c="white">{metadata.name}</Text>
                    <Group gap="xs">
                       <Badge size="xs" variant="dot" color={metadata.color}>{providerKey.toUpperCase()}</Badge>
                       {hasKey ? (
                         <Group gap={4}>
                           <IconCircleCheck size={12} color="#22c55e" />
                           <Text size="xs" c="green" fw={600}>Operational</Text>
                         </Group>
                       ) : (
                         <Group gap={4}>
                           <IconAlertTriangle size={12} color="#f59e0b" />
                           <Text size="xs" c="orange" fw={600}>API Key Required</Text>
                         </Group>
                       )}
                    </Group>
                  </Box>
                </Group>

                <Paper p="xs" radius="md" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <Stack gap={0} align="center" px="md">
                        <Text size="xs" c="dimmed" fw={700}>DIMENSIONS</Text>
                        <Text size="xl" fw={900} c="violet">{metadata.dimensions}</Text>
                    </Stack>
                </Paper>
              </Group>

              <Divider style={{ opacity: 0.1 }} />

              <Box>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {metadata.description}
                </Text>
              </Box>

              {!hasKey && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                  The chosen provider requires a valid API key in your Workspace Settings to process new embeddings.
                </Alert>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={4}>
          <Stack gap="md">
             <Paper withBorder p="xl" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
                <Stack gap="md">
                   <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: rem(1) }}>TECHNICAL SPECS</Text>
                   <Stack gap="xs">
                      <SpecItem icon={IconFingerprint} label="Encoding" value="cl100k_base" />
                      <SpecItem icon={IconVariable} label="Norm" value="L2 Euclidean" />
                      <SpecItem icon={IconMaximize} label="Max Tokens" value="8,192" />
                   </Stack>
                </Stack>
             </Paper>

             <Paper p="xl" radius="md" style={{ background: "linear-gradient(135deg, rgba(147,51,234,0.1), rgba(79,70,229,0.1))", border: "1px solid rgba(147,51,234,0.2)" }}>
                <Stack gap="xs">
                   <Text size="sm" fw={700} c="white">Re-indexing</Text>
                   <Text size="xs" c="dimmed">Updating the memory provider will trigger a background re-index of all currently selected tables.</Text>
                </Stack>
             </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function SpecItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <Group justify="space-between">
      <Group gap="xs">
        <Icon size={14} color="rgba(255,255,255,0.3)" />
        <Text size="xs" c="dimmed">{label}</Text>
      </Group>
      <Text size="xs" fw={600} c="white">{value}</Text>
    </Group>
  );
}

