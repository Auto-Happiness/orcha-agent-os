import { Stack, Paper, TextInput, Textarea, Group, Text, Badge, ActionIcon, Grid } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";

interface DeploymentProfileProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  businessContext: string;
  setBusinessContext: (v: string) => void;
  tags: string[];
  setTags: (v: string[]) => void;
}

export function DeploymentProfile({
  name,
  setName,
  description,
  setDescription,
  businessContext,
  setBusinessContext,
  tags,
  setTags
}: DeploymentProfileProps) {
  return (
    <Grid styles={{ inner: { gap: "var(--mantine-spacing-xl)" } }}>
      <Grid.Col span={8}>
        <Paper withBorder p="2.5rem" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
           <Stack gap="xl">
              <TextInput label="Friendly Name" size="md" styles={inputStyles} value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea label="Environment Description" styles={inputStyles} minRows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Textarea label="Librarian's Common Sense Context" styles={inputStyles} minRows={6} value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} />
           </Stack>
        </Paper>
      </Grid.Col>
      
      <Grid.Col span={4}>
        <Stack gap="xl">
            <Paper withBorder p="xl" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
               <Stack gap="md">
                  <Text size="xs" fw={700} c="dimmed">Environment Tags</Text>
                  <Group gap="xs">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="light" color="violet" radius="xs" rightSection={<ActionIcon size="xs" variant="transparent" onClick={() => setTags(tags.filter(t => t !== tag))}>×</ActionIcon>}>{tag}</Badge>
                    ))}
                  </Group>
                  <TextInput placeholder="Add +" size="xs" styles={inputStyles} onKeyDown={(e) => { if (e.key === "Enter") { const val = e.currentTarget.value.trim(); if (val && !tags.includes(val)) { setTags([...tags, val]); e.currentTarget.value = ""; } } }} />
               </Stack>
            </Paper>
            <Paper withBorder p="xl" radius="md" style={{ background: "rgba(147, 51, 234, 0.05)", borderColor: "rgba(147,51,234,0.2)" }}>
               <Stack gap="xs">
                  <Group gap="xs"><IconCheck size={16} color="#a855f7" /><Text size="sm" fw={700} c="white">Sync Status</Text></Group>
                  <Text size="xs" c="dimmed">Your semantic bridge is synchronized with your database schema.</Text>
               </Stack>
            </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
