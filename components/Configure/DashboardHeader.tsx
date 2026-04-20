import { Paper, Group, Avatar, rem, Stack, Title, Badge, Text } from "@mantine/core";
import { IconCheck, IconDatabase } from "@tabler/icons-react";

interface DashboardHeaderProps {
  currentConfig: any;
  identiconUrl: string;
}

export function DashboardHeader({ currentConfig, identiconUrl }: DashboardHeaderProps) {
  return (
    <Paper withBorder p="md" radius="md" style={{ background: "rgba(255,255,255,0.005)", borderColor: "rgba(255,255,255,0.05)" }}>
      <Group justify="space-between" align="center">
        <Group gap="md">
           <Avatar src={currentConfig.image || identiconUrl} size={rem(54)} radius="md" style={{ border: "1px solid rgba(147,51,234,0.2)" }} />
           <Stack gap={0}>
             <Group gap="xs">
               <Title order={1} c="white" size="1.25rem">{currentConfig.name}</Title>
               <Badge variant="dot" color="green" size="xs">STABLE</Badge>
             </Group>
             <Group gap="md" mt={2}>
                <Group gap={4}><IconCheck size={10} color="#a855f7" /><Text size="10px" c="dimmed">Sync: OK</Text></Group>
                <Group gap={4}><IconDatabase size={10} color="rgba(255,255,255,0.3)" /><Text size="10px" c="dimmed">{currentConfig.type?.toUpperCase()}</Text></Group>
             </Group>
           </Stack>
        </Group>
        
        <Text size="10px" c="dimmed" fw={500} style={{ opacity: 0.5 }}>ID: {currentConfig._id.slice(-8)}</Text>
      </Group>
    </Paper>
  );
}
