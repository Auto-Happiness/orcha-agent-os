"use client";

import { 
  Stack, 
  Group, 
  Text, 
  Box, 
  rem,
  Alert,
  Divider,
  ThemeIcon,
  Paper,
  UnstyledButton,
  Badge,
  Collapse,
  Title,
  Center,
  Transition
} from "@mantine/core";
import { 
  IconBrain, 
  IconAlertTriangle, 
  IconCheck, 
  IconNetwork,
  IconCpu,
  IconSparkles,
  IconBrandOpenai,
  IconServer,
  IconChevronRight,
  IconCircle,
  IconCircleCheckFilled
} from "@tabler/icons-react";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useEffect } from "react";

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini Pro",
    icon: IconSparkles,
    dimensions: 768,
    color: "blue",
    description: "Ideal for high-speed schema indexing and standard search across relational structures. Offers a great balance of latency and retrieval precision."
  },
  {
    id: "openai",
    name: "OpenAI Text Embedding",
    icon: IconBrandOpenai,
    dimensions: 1536,
    color: "teal",
    description: "High-resolution semantic mapping. With 1536 dimensions, this provider can capture extremely subtle nuances in complex schemas with hundreds of tables."
  },
  {
    id: "local",
    name: "Ollama (Local Llama)",
    icon: IconServer,
    dimensions: 1024,
    color: "gray",
    description: "Run your semantic memory locally for maximum privacy and zero latency. Uses local execution without routing data to external cloud providers."
  }
];

export function MemoryConfig() {
  const { saas } = useParams();
  const { data, updateData } = useCreationWizard();
  const { isAuthenticated } = useConvexAuth();

  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const aiKeys = useQuery(api.aiKeys.listByOrganization, (isAuthenticated && activeOrg?._id) ? { organizationId: activeOrg._id } : "skip");

  const isLoading = !aiKeys && isAuthenticated;

  const checkHasKey = (providerId: string) => {
    if (providerId === "local") return true;
    return !!aiKeys?.some(k => k.provider === providerId);
  };

  return (
    <Stack gap="xl" py="xl">
      <Box>
        <Group justify="space-between" mb="md">
          <Stack gap={2}>
            <Title order={3} size="h3" c="white">Semantic Memory Layer</Title>
            <Text size="xs" c="dimmed">Choose the search engine used for indexing your tables (RAG). Higher resolution provides better accuracy for large schemas.</Text>
          </Stack>
          <ThemeIcon variant="light" color="violet" size="lg" radius="md">
            <IconBrain size={20} />
          </ThemeIcon>
        </Group>
        <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} mt="md" />
      </Box>

      <Stack gap="md">
        {PROVIDERS.map((provider) => {
          const isSelected = data.memoryProvider === provider.id;
          const hasKey = checkHasKey(provider.id);
          const Icon = provider.icon;

          return (
            <Paper
              key={provider.id}
              onClick={() => updateData({ memoryProvider: provider.id as any })}
              component="div"
              shadow={isSelected ? "md" : "xs"}
              style={{
                background: isSelected ? "rgba(147,51,234,0.06)" : "rgba(255,255,255,0.01)",
                border: `1px solid ${isSelected ? "rgba(147,51,234,0.4)" : "rgba(255,255,255,0.05)"}`,
                borderRadius: rem(12),
                padding: rem(20),
                transition: "all 0.2s ease",
                width: "100%",
                cursor: "pointer",
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="md">
                    <ThemeIcon 
                      variant="light" 
                      color={provider.color} 
                      size="xl" 
                      radius="md"
                      style={{ background: isSelected ? undefined : "rgba(255,255,255,0.03)" }}
                    >
                      <Icon size={24} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={700} size="md" c={isSelected ? "white" : "dimmed"}>{provider.name}</Text>
                      <Group gap={6}>
                        <Badge variant="dot" size="xs" color="gray" styles={{ label: { textTransform: "none" }}}>{provider.dimensions} dimensions</Badge>
                        {isSelected && (
                             <Badge variant="light" size="xs" color={hasKey ? "green" : "red"}>
                                {hasKey ? "Key Configured" : "Key Needed"}
                             </Badge>
                        )}
                      </Group>
                    </Stack>
                  </Group>

                  {/* Right Side Radio Indicator */}
                  {isSelected ? (
                    <IconCircleCheckFilled size={24} color="var(--mantine-color-violet-6)" />
                  ) : (
                    <IconCircle size={24} color="rgba(255,255,255,0.1)" />
                  )}
                </Group>

                  <Transition mounted={isSelected} transition="fade" duration={200} timingFunction="ease">
                    {(styles) => (
                      <Stack gap="md" pt="md" style={styles}>
                            <Divider style={{ borderColor: "rgba(147,51,234,0.1)" }} />
                            <Text size="xs" lh={1.6} c="dimmed">
                                {provider.description}
                            </Text>
                            
                            {!isLoading && !hasKey && (
                                <Alert variant="light" color="red" py="xs" icon={<IconAlertTriangle size={14} />}>
                                    <Text size="11px">
                                        Your organization is missing the API key for <b>{provider.name}</b>. Please configure it in your <b>Workspace Settings</b> to proceed.
                                    </Text>
                                </Alert>
                            )}
                            
                            {hasKey && (
                                <Group gap={6}>
                                    <IconCheck size={14} color="#22c55e" />
                                    <Text size="xs" c="green" fw={600}>Operational Readiness: 100%</Text>
                                </Group>
                            )}
                      </Stack>
                    )}
                  </Transition>
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {/* Pro Tip Section */}
      <Paper p="md" radius="sm" style={{ border: "1px dashed rgba(255,255,255,0.1)", background: "transparent" }}>
          <Group gap="xs" mb={4}>
            <IconNetwork size={14} color="rgba(255,255,255,0.4)" />
            <Text size="xs" fw={700} c="dimmed">Architecture Guide</Text>
          </Group>
          <Text size="xs" c="dimmed" lh={1.5}>
            Embedding dimensions are numerical representations of meaning. Higher resolutions (1536d) are recommended for complex, high-scale table structures to prevent semantic collisions.
          </Text>
      </Paper>
    </Stack>
  );
}
