import { Paper, Group, Avatar, rem, Stack, Title, Badge, Text } from "@mantine/core";
import { IconCheck, IconDatabase } from "@tabler/icons-react";

interface DashboardHeaderProps {
  currentConfig: any;
  identiconUrl: string;
}

export function DashboardHeader({ currentConfig, identiconUrl }: DashboardHeaderProps) {
  return (
    <Paper withBorder p="2.5rem" radius="md" style={{ background: "rgba(255,255,255,0.012)", borderColor: "rgba(147,51,234,0.12)" }}>
      <Group align="flex-start" gap="2.5rem">
         <Avatar src={currentConfig.image || identiconUrl} size={rem(140)} radius="lg" style={{ border: "2px solid rgba(147,51,234,0.3)", background: "rgba(147,51,234,0.05)" }} />
         <Stack gap={8}>
           <Group gap="xs">
             <Title order={1} c="white" size="2.5rem">{currentConfig.name}</Title>
             <Badge variant="dot" color="green" size="md">STABLE</Badge>
           </Group>
           <Group gap="xl">
              <Group gap={6}><IconCheck size={14} color="#a855f7" /><Text size="xs" c="dimmed">Semantic Sync: Ready</Text></Group>
              <Group gap={6}><IconDatabase size={14} color="rgba(255,255,255,0.4)" /><Text size="xs" c="dimmed">{currentConfig.type.toUpperCase()}</Text></Group>
           </Group>
         </Stack>
      </Group>
    </Paper>
  );
}
