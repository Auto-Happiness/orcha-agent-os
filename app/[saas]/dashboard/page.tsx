"use client";

import {
  Grid,
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Progress,
  ThemeIcon,
  SimpleGrid,
  Box,
  RingProgress,
  Title,
} from "@mantine/core";
import { useEffect } from "react";
import {
  IconRobot,
  IconPlugConnected,
  IconActivity,
  IconArrowUpRight,
  IconArrowDownRight,
  IconBolt,
  IconClock,
  IconCheck,
} from "@tabler/icons-react";
import { useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";

/* ─── Stat card ──────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  delta,
  positive,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card
      padding="lg"
      radius="md"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(147,51,234,0.12)",
      }}
    >
      <Group justify="space-between" mb="xs">
        <ThemeIcon size="md" radius="md" variant="light" color={color}>
          <Icon size={16} />
        </ThemeIcon>
        <Badge
          size="xs"
          variant="light"
          color={positive ? "green" : "red"}
          leftSection={
            positive ? <IconArrowUpRight size={10} /> : <IconArrowDownRight size={10} />
          }
        >
          {delta}
        </Badge>
      </Group>
      <Text size="xl" fw={700} c="white">{value}</Text>
      <Text size="xs" c="dimmed" mt={2}>{label}</Text>
    </Card>
  );
}

/* ─── Agent row ──────────────────────────────────────────────────────────── */

function AgentRow({
  name,
  status,
  runs,
  successRate,
}: {
  name: string;
  status: "active" | "idle" | "error";
  runs: number;
  successRate: number;
}) {
  const statusColor = status === "active" ? "green" : status === "idle" ? "yellow" : "red";
  return (
    <Group justify="space-between" py="xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <Group gap="sm">
        <ThemeIcon size="sm" radius="xl" variant="light" color="violet">
          <IconRobot size={12} />
        </ThemeIcon>
        <div>
          <Text size="sm" c="white" fw={500}>{name}</Text>
          <Text size="xs" c="dimmed">{runs} runs today</Text>
        </div>
      </Group>
      <Group gap="md">
        <Box w={80}>
          <Progress value={successRate} size="xs" color="violet" radius="xl" />
        </Box>
        <Text size="xs" c="dimmed" w={30} ta="right">{successRate}%</Text>
        <Badge size="xs" color={statusColor} variant="dot">{status}</Badge>
      </Group>
    </Group>
  );
}

/* ─── Dashboard page ─────────────────────────────────────────────────────── */

const STATS = [
  { label: "Active Agents",      value: "12",    delta: "+2 this week",  positive: true,  icon: IconRobot,        color: "violet" },
  { label: "Pipeline Executions",value: "1,284", delta: "+18.4%",        positive: true,  icon: IconPlugConnected, color: "indigo" },
  { label: "Avg. Latency",       value: "320ms", delta: "-12ms",         positive: true,  icon: IconBolt,         color: "cyan"   },
  { label: "Errors (24h)",       value: "3",     delta: "+1",            positive: false, icon: IconActivity,     color: "red"    },
];

const AGENTS = [
  { name: "Customer Support Bot",   status: "active" as const, runs: 142, successRate: 98 },
  { name: "Data Pipeline Extractor",status: "active" as const, runs: 87,  successRate: 94 },
  { name: "Report Generator",       status: "idle"   as const, runs: 33,  successRate: 100 },
  { name: "Email Triage Agent",     status: "error"  as const, runs: 21,  successRate: 71 },
];

export default function DashboardPage() {
  const { user } = useUser();
  const params   = useParams<{ saas: string }>();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Box p="xl" style={{ color: "white" }}>
      <title>{params?.saas ? `Dashboard - ${params.saas}` : "Dashboard"}</title>
      {/* Page header */}
      <Stack gap={4} mb="xl">
        <Title order={2} c="white" fw={700}>
          {greeting}, {user?.firstName ?? "there"} 👋
        </Title>
        <Text c="dimmed" size="sm">
          Here&apos;s what&apos;s happening in your <Text span c="violet.4" fw={500}>{params?.saas}</Text> workspace.
        </Text>
      </Stack>

      {/* Stats row */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </SimpleGrid>

      {/* Main grid */}
      <Grid>
        {/* Agents list */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card
            padding="lg"
            radius="md"
            h="100%"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(147,51,234,0.12)" }}
          >
            <Group justify="space-between" mb="md">
              <Text fw={600} c="white">Active Agents</Text>
              <Badge size="sm" variant="light" color="violet">12 running</Badge>
            </Group>
            <Stack gap={0}>
              {AGENTS.map((a) => <AgentRow key={a.name} {...a} />)}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Right column */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            {/* Success ring */}
            <Card
              padding="lg"
              radius="md"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(147,51,234,0.12)" }}
            >
              <Text fw={600} c="white" mb="md">Overall Health</Text>
              <Group justify="center">
                <RingProgress
                  size={140}
                  thickness={12}
                  roundCaps
                  sections={[{ value: 94, color: "violet" }]}
                  label={
                    <Stack gap={2} align="center">
                      <Text size="xl" fw={700} c="white">94%</Text>
                      <Text size="10px" c="dimmed">success rate</Text>
                    </Stack>
                  }
                />
              </Group>
              <SimpleGrid cols={3} mt="sm">
                {[
                  { icon: IconCheck, label: "Success", value: "1,207", c: "green" },
                  { icon: IconClock, label: "Pending", value: "74",    c: "yellow" },
                  { icon: IconActivity, label: "Failed", value: "3",   c: "red" },
                ].map((item) => (
                  <Stack key={item.label} gap={2} align="center">
                    <ThemeIcon size="sm" variant="light" color={item.c} radius="xl">
                      <item.icon size={11} />
                    </ThemeIcon>
                    <Text size="sm" c="white" fw={600}>{item.value}</Text>
                    <Text size="10px" c="dimmed">{item.label}</Text>
                  </Stack>
                ))}
              </SimpleGrid>
            </Card>

            {/* Recent activity */}
            <Card
              padding="lg"
              radius="md"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(147,51,234,0.12)" }}
            >
              <Text fw={600} c="white" mb="md">Recent Activity</Text>
              <Stack gap="xs">
                {[
                  { msg: "Customer Support Bot completed run #142",   t: "2m ago",  ok: true  },
                  { msg: "Email Triage Agent encountered an error",    t: "15m ago", ok: false },
                  { msg: "Report Generator finished monthly report",   t: "1h ago",  ok: true  },
                  { msg: "Data Extractor processed 2,400 records",     t: "3h ago",  ok: true  },
                ].map((item, i) => (
                  <Group key={i} gap="sm" align="flex-start">
                    <ThemeIcon size="xs" radius="xl" variant="light" color={item.ok ? "green" : "red"} mt={3}>
                      {item.ok ? <IconCheck size={9} /> : <IconActivity size={9} />}
                    </ThemeIcon>
                    <Box style={{ flex: 1 }}>
                      <Text size="xs" c="rgba(255,255,255,0.75)" lh={1.4}>{item.msg}</Text>
                      <Text size="10px" c="dimmed">{item.t}</Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
