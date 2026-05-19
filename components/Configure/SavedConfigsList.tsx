"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
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
  Select,
  Skeleton,
  Center,
  Loader,
  Progress,
  Modal,
  Alert
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconDots,
  IconCloudCheck,
  IconDatabase,
  IconExternalLink,
  IconBrandMysql,
  IconBrandMongodb,
  IconSql,
  IconServer,
  IconTableFilled,
  IconCircleCheck,
  IconAlertCircle,
  IconRobot
} from "@tabler/icons-react";
import { inputStyles, selectStyles } from "@/lib/styles";

const TYPE_OPTIONS = [
  { value: "postgres", label: "PostgreSQL", icon: IconSql },
  { value: "mysql", label: "MySQL", icon: IconBrandMysql },
  { value: "mssql", label: "MSSQL", icon: IconServer },
  { value: "mongodb", label: "MongoDB", icon: IconBrandMongodb },
  { value: "bigquery", label: "BigQuery", icon: IconTableFilled },
  { value: "model", label: "AI Models", icon: IconRobot },
];


export function SavedConfigsList() {
  const { saas } = useParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const { reset } = useCreationWizard();

  // 1. Resolve Organization ID
  const organization = useQuery(api.organizations.getSafeBySlug, {
    slug: saas as string
  });

  // 2. Fetch AI Keys to ensure at least one is configured before wizard
  const aiKeys = useQuery(
    api.aiKeys.listByOrganization,
    organization ? { organizationId: organization._id } : "skip"
  );

  const handleNewConfig = () => {
    // If keys are still loading, wait. If empty, show warning.
    if (aiKeys === undefined) return;

    if (aiKeys.length === 0) {
      notifications.show({
        title: "Intelligence Layer Required",
        message: "Please add an LLM API key (OpenAI, Gemini, or Local) in settings to begin creating your environment.",
        color: "violet",
        icon: <IconAlertCircle size={18} />,
        autoClose: 5000,
      });
      setShowKeyWarning(true);
      return;
    }

    reset(); // Wipe all previous wizard state before entering a fresh session
    router.push(`/${saas}/configure/new`);
  };

  // 2. Fetch Live Configs
  const configs = useQuery(
    api.databaseConfigs.listByOrganization,
    organization ? { organizationId: organization._id } : "skip"
  );

  // 3. Client-side Filtering Logic
  const filteredConfigs = useMemo(() => {
    if (!configs) return [];

    return configs.filter(config => {
      // Search matching
      const matchesSearch = !search ||
        config.name.toLowerCase().includes(search.toLowerCase()) ||
        config._id.toLowerCase().includes(search.toLowerCase());

      // Type matching
      const matchesType = !typeFilter || config.type === typeFilter;

      // Status matching (Rename 'Ready' -> 'Online', default rest to 'Offline')
      const status = config.status === "ready" || config.status === undefined ? "Online" : "Offline";
      const matchesStatus = !statusFilter || status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [configs, search, typeFilter, statusFilter]);

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
          <Tooltip 
            label="Please add an API key in organization settings to create an environment" 
            disabled={aiKeys && aiKeys.length > 0}
            position="bottom"
            withArrow
          >
            <Button
              onClick={handleNewConfig}
              variant="light"
              color="violet"
              leftSection={<IconPlus size={16} />}
            >
              Create Environment
            </Button>
          </Tooltip>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            placeholder="All Engines"
            data={TYPE_OPTIONS}
            styles={selectStyles}
            w={180}
            leftSection={<IconFilter size={14} />}
            clearable
            value={typeFilter}
            onChange={setTypeFilter}
            renderOption={(item) => {
              const option = TYPE_OPTIONS.find(opt => opt.value === item.option.value);
              const Icon = option?.icon || IconDatabase;
              return (
                <Group gap="xs">
                  <Icon size={14} />
                  <Text size="sm">{item.option.label}</Text>
                </Group>
              );
            }}
          />
          <Select
            placeholder="Status"
            data={["Online", "Offline"]}
            styles={selectStyles}
            w={120}
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </Group>

        <Tooltip 
          label="API Key Required" 
          disabled={aiKeys && aiKeys.length > 0}
          position="left"
          withArrow
        >
          <Button
            onClick={handleNewConfig}
            variant="light"
            color="violet"
            leftSection={<IconPlus size={16} />}
          >
            New Configuration
          </Button>
        </Tooltip>
      </Group>

      <Paper withBorder style={{
        background: "rgba(255,255,255,0.012)",
        borderColor: "rgba(147,51,234,0.12)",
        overflow: "hidden"
      }} radius="md">
        <Stack gap={0}>
          {filteredConfigs.map((config, index) => {
            const isOnline = config.status === "ready" || config.status === undefined;
            const engineInfo = TYPE_OPTIONS.find(o => o.value === config.type);
            const EngineIcon = engineInfo?.icon || IconDatabase;

            return (
              <Box
                key={config._id}
                style={{
                  borderBottom: index !== filteredConfigs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
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
                          <Badge variant="dot" color={isOnline ? "green" : "red"} size="xs" tt="none">
                            {isOnline ? "Online" : "Offline"}
                          </Badge>
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
                        <Stack gap={0} w={150}>
                          <Group gap="xs">
                            <EngineIcon size={14} color="#9333ea" />
                            <Text size="11px" fw={500} c="white" style={{ textTransform: "capitalize" }}>{config.type}</Text>
                          </Group>
                          {config.indexingStatus === "processing" ? (
                            <Stack gap={2} mt={4}>
                              <Progress
                                value={((config.indexingProgress || 0) / (config.indexingTotal || 1)) * 100}
                                size="xs"
                                color="violet"
                                animated
                              />
                              <Text size="9px" c="dimmed">Indexing: {config.indexingProgress || 0}/{config.indexingTotal || 0}</Text>
                            </Stack>
                          ) : config.indexingStatus === "completed" ? (
                            <Group gap={4} mt={2}>
                              <IconCircleCheck size={10} color="#22c55e" />
                              <Text size="10px" c="#22c55e" fw={500}>Semantic Ready</Text>
                            </Group>
                          ) : (
                            <Text size="10px" c="dimmed">Active Semantic Bridge</Text>
                          )}
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
            );
          })}
        </Stack>
      </Paper>

      {/* ── AI Key Safeguard Modal ────────────────────────────────────── */}
      <Modal
        opened={showKeyWarning}
        onClose={() => setShowKeyWarning(false)}
        title={<Text fw={700}>Intelligence Layer Required</Text>}
        centered
        styles={{
          content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.18)" },
          header: { background: "#130f22" },
        }}
      >
        <Stack gap="xl">
          <Alert color="violet" variant="light" icon={<IconAlertCircle size={20} />}>
            Orcha requires at least one **LLM API Key** (OpenAI, Gemini, or Local) to perform semantic analysis and index your database.
          </Alert>

          <Text size="sm" c="dimmed">
            Please configure your AI provider in the organization settings before connecting a new database environment.
          </Text>

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setShowKeyWarning(false)}>
              Cancel
            </Button>
            <Button
              component={Link}
              href={`/${saas}/settings/ai-keys`}
              color="violet"
              onClick={() => setShowKeyWarning(false)}
            >
              Configure AI Keys
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
