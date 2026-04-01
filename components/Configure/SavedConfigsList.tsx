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

export function SavedConfigsList() {
  const { saas } = useParams();
  
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
          {MOCK_CONFIGS.map((config, index) => (
            <Box 
              key={config.id}
              style={{
                borderBottom: index !== MOCK_CONFIGS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                transition: "all 200ms ease"
              }}
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
                  {/* ID & Type Information */}
                  <Stack gap={2} w={140}>
                    <Group gap="xs">
                       <Text fw={700} size="sm" c="white">{config.id}</Text>
                       {config.status === "ready" ? (
                         <Badge variant="dot" color="green" size="xs">Ready</Badge>
                       ) : (
                         <Badge variant="dot" color="red" size="xs">Error</Badge>
                       )}
                    </Group>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">Production</Text>
                      {config.isPrimary && <Badge size="9px" variant="light" color="blue" radius="xs">CURRENT</Badge>}
                    </Group>
                  </Stack>

                  {/* Project / Config Name */}
                  <Group gap="md">
                    <ThemeIcon variant="light" color="violet" radius="md" size="md">
                      {config.type === "database" ? <IconDatabase size={16} /> : <IconRobot size={16} />}
                    </ThemeIcon>
                    <Text fw={600} size="sm" c="white">{config.name}</Text>
                  </Group>
                </Group>

                <Group gap={rem(48)}>
                  {/* Provider & Sync Details */}
                  <Group gap={40}>
                     <Stack gap={0} w={120}>
                        <Group gap="xs">
                           <IconCloudCheck size={14} color="#9333ea" />
                           <Text size="xs" fw={500} c="white">{config.provider}</Text>
                        </Group>
                        {config.tables > 0 && <Text size="10px" c="dimmed">{config.tables} tables mapped</Text>}
                     </Stack>
                     <Text size="xs" c="dimmed">{config.syncTime}</Text>
                  </Group>

                  {/* Date & Author */}
                  <Group gap="md">
                     <Text size="xs" c="dimmed">{config.date} by {config.author}</Text>
                     <Avatar src={null} size="xs" color="violet" radius="xl" variant="light">
                       {config.author[0].toUpperCase()}
                     </Avatar>
                     <ActionIcon variant="transparent" color="dimmed" size="sm">
                       <IconDots size={16} />
                     </ActionIcon>
                  </Group>
                </Group>
              </Group>
              {index !== MOCK_CONFIGS.length - 1 && <Divider style={{ borderColor: "rgba(255,255,255,0.04)" }} />}
            </Box>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
