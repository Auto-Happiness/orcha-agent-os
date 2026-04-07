"use client";

import { 
  Paper, 
  Stack, 
  Group, 
  Text, 
  Badge, 
  Avatar, 
  TextInput, 
  Button, 
  ActionIcon, 
  Divider, 
  Box, 
  rem,
  ThemeIcon,
  Tooltip,
  Select
} from "@mantine/core";
import { 
  IconSearch, 
  IconFilter, 
  IconPlus, 
  IconDots, 
  IconCircleFilled, 
  IconCloudCheck, 
  IconDatabase,
  IconRobot,
  IconExternalLink,
  IconCopy,
  IconChevronDown,
  IconAlertCircle
} from "@tabler/icons-react";
import { inputStyles, selectStyles } from "@/lib/styles";

const MOCK_CONFIGS = [
  {
    id: "78cLwM2Qi",
    name: "Production Inventory",
    type: "database",
    provider: "PostgreSQL",
    status: "ready",
    syncTime: "48s",
    tables: 24,
    author: "svenmomancer",
    date: "Mar 21",
    isPrimary: true
  },
  {
    id: "HdiuzdZO",
    name: "Customer Analytics",
    type: "database",
    provider: "BigQuery",
    status: "ready",
    syncTime: "49s",
    tables: 12,
    author: "svenmomancer",
    date: "Mar 21",
    isPrimary: false
  },
  {
    id: "J5Vwu9Sue",
    name: "Gemini 2.0 Pro",
    type: "model",
    provider: "Google Vertex",
    status: "ready",
    syncTime: "45s",
    tables: 0,
    author: "svenmomancer",
    date: "Mar 18",
    isPrimary: true
  },
  {
    id: "HLyv1kh6c",
    name: "Staging MongoDB",
    type: "database",
    provider: "MongoDB",
    status: "ready",
    syncTime: "47s",
    tables: 5,
    author: "svenmomancer",
    date: "Mar 18",
    isPrimary: false
  },
  {
    id: "D2oiuiKp4",
    name: "Legacy MSSQL",
    type: "database",
    provider: "MSSQL",
    status: "error",
    syncTime: "6s",
    tables: 0,
    author: "naughtyowl",
    date: "Mar 7",
    isPrimary: false
  }
];

import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton, Center, Loader } from "@mantine/core";

export function SavedConfigsList() {
  const { saas } = useParams();
  
  // 1. Resolve Organization ID
  const organization = useQuery(api.organizations.getSafeBySlug, { 
    slug: saas as string 
  });

  // 2. Fetch Live Configs
  const configs = useQuery(
    api.databaseConfigs.listByOrganization,
    organization ? { organizationId: organization._id } : "skip"
  );

  if (organization === undefined || configs === undefined) {
    return (
      <Stack gap="md">
        <Skeleton h={80} radius="md" />
        <Skeleton h={80} radius="md" />
        <Skeleton h={80} radius="md" />
      </Stack>
    );
  }

  if (configs.length === 0) {
    return (
      <Paper withBorder p="3rem" radius="md" style={{ background: "rgba(255,255,255,0.012)", borderColor: "rgba(147,51,234,0.15)" }}>
        <Stack align="center" gap="sm">
          <IconDatabase size={48} color="rgba(147,51,234,0.3)" />
          <Text fw={600} c="white">No active environments found</Text>
          <Text size="xs" c="dimmed" mb="md">Connect your first database to start building your semantic bridge.</Text>
          <Button 
            component={Link} 
            href={`/${saas}/configure/new`} 
            variant="light" 
            color="violet" 
            leftSection={<IconPlus size={16} />}
          >
            Create Environment
          </Button>
        </Stack>
      </Paper>
    );
  }
  
  return (
    <Stack gap="xl" mb={40}>
      <Group justify="space-between">
        <Group gap="md">
          <TextInput 
            placeholder="Search configurations..." 
            leftSection={<IconSearch size={14} />} 
            styles={inputStyles}
            w={300}
          />
          <Select 
            placeholder="All Types" 
            data={["Databases", "Models"]} 
            styles={selectStyles}
            w={140}
            leftSection={<IconFilter size={14} />}
          />
          <Select 
            placeholder="Status" 
            data={["Ready", "Error"]} 
            styles={selectStyles}
            w={120}
          />
        </Group>

        <Button 
          component={Link} 
          href={`/${saas}/configure/new`} 
          variant="light" 
          color="violet" 
          leftSection={<IconPlus size={16} />}
        >
          New Configuration
        </Button>
      </Group>

      <Paper withBorder style={{ 
        background: "rgba(255,255,255,0.012)", 
        borderColor: "rgba(147,51,234,0.12)",
        overflow: "hidden"
      }} radius="md">
        <Stack gap={0}>
          {configs.map((config, index) => (
            <Box 
              key={config._id}
              style={{
                borderBottom: index !== configs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                transition: "all 200ms ease"
              }}
            >
              <Link 
                href={`/${saas}/configure/${config._id}`} 
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Group 
                  p="md" 
                  justify="space-between" 
                  wrap="nowrap"
                  style={{ 
                    background: "transparent",
                    transition: "all 200ms ease",
                    cursor: "pointer",
                  }}
                  className="config-row-hover"
                >
                  <style jsx>{`
                    .config-row-hover {
                      transition: all 0.2s ease;
                    }
                    .config-row-hover:hover {
                      background: rgba(147, 51, 234, 0.05) !important;
                      box-shadow: inset 2px 0 0 #9333ea;
                    }
                  `}</style>
                  <Group gap="xl">
                    {/* ID & Status */}
                    <Stack gap={2} w={140}>
                      <Group gap="xs">
                         <Text fw={700} size="xs" c="white" ff="monospace">{config._id.slice(-8)}</Text>
                         <Badge variant="dot" color="green" size="xs">Ready</Badge>
                      </Group>
                      <Group gap={6}>
                        <Text size="xs" c="dimmed">Production</Text>
                      </Group>
                    </Stack>

                    {/* Environment Identity */}
                    <Group gap="md">
                      <Avatar 
                        src={config.image} 
                        radius="md" 
                        size="md"
                        style={{ border: "1px solid rgba(147,51,234,0.2)" }} 
                      />
                      <Stack gap={0}>
                        <Text fw={600} size="sm" c="white">{config.name}</Text>
                        <Text size="xs" c="dimmed" ff="monospace" style={{ opacity: 0.7 }}>
                          {config.type.toUpperCase()}
                        </Text>
                      </Stack>
                    </Group>
                  </Group>

                  <Group gap={rem(48)}>
                    {/* Provider Details */}
                    <Group gap={40}>
                       <Stack gap={0} w={120}>
                          <Group gap="xs">
                             <IconCloudCheck size={14} color="#9333ea" />
                             <Text size="11px" fw={500} c="white" style={{ textTransform: "capitalize" }}>{config.type}</Text>
                          </Group>
                          <Text size="10px" c="dimmed">Active Semantic Bridge</Text>
                       </Stack>
                       <Text size="xs" c="dimmed">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(config.updatedAt)}</Text>
                    </Group>

                    {/* Project Meta */}
                    <Group gap="md">
                       <Tooltip label="Open Deployment">
                          <ActionIcon variant="light" color="violet" size="sm">
                            <IconExternalLink size={14} />
                          </ActionIcon>
                       </Tooltip>
                       <ActionIcon variant="transparent" color="dimmed" size="sm">
                         <IconDots size={16} />
                       </ActionIcon>
                    </Group>
                  </Group>
                </Group>
              </Link>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

