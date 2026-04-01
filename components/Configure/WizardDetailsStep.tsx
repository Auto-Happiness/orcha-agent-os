import { 
  Stack, 
  Group, 
  Text, 
  TextInput, 
  Textarea, 
  Avatar, 
  ActionIcon, 
  Badge, 
  Box, 
  rem,
  MultiSelect,
  Grid
} from "@mantine/core";
import { IconCameraPlus, IconTags, IconPencil, IconPhoto } from "@tabler/icons-react";
import { inputStyles, selectStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function WizardDetailsStep() {
  const { data, updateData } = useCreationWizard();

  return (
    <Stack gap={40} py="xl">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
           <Stack align="center" gap="md">
              <Text size="sm" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>Identity Profile</Text>
              <Box style={{ position: "relative" }}>
                 <Avatar 
                    src={data.image} 
                    size={rem(180)} 
                    radius="md" 
                    variant="light" 
                    color="violet"
                    style={{ border: "2px dashed rgba(147,51,234,0.3)", background: "rgba(147,51,234,0.05)" }}
                  >
                    <IconPhoto size={48} color="rgba(147,51,234,0.4)" />
                  </Avatar>
                  <ActionIcon 
                    variant="filled" 
                    color="violet" 
                    radius="xl" 
                    size="lg"
                    style={{ position: "absolute", bottom: -10, right: -10, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                  >
                    <IconCameraPlus size={18} />
                  </ActionIcon>
              </Box>
              <Text size="xs" c="dimmed" ta="center" px="xl">Upload a custom avatar or identifier for this connection profile.</Text>
           </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
           <Stack gap="xl">
              <TextInput 
                label="Connection Display Name" 
                placeholder="e.g. Production Analytics Lake" 
                styles={inputStyles}
                value={data.name}
                onChange={(e) => updateData({ name: e.target.value })}
                leftSection={<IconPencil size={14} />}
              />

              <Textarea 
                label="Deployment Description" 
                placeholder="Briefly describe the purpose of this connection for the AI agent context..." 
                styles={inputStyles}
                minRows={4}
                value={data.description}
                onChange={(e) => updateData({ description: e.target.value })}
              />

              <Stack gap="xs">
                <TextInput
                  label="Resource Tags"
                  placeholder="Type a tag and press Enter..."
                  styles={inputStyles}
                  leftSection={<IconTags size={14} />}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = e.currentTarget.value.trim();
                      if (val && !data.tags.includes(val)) {
                        updateData({ tags: [...data.tags, val] });
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
                <Group gap="xs">
                  {data.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="light" 
                      color="violet" 
                      radius="xs"
                      rightSection={
                        <ActionIcon 
                          size="xs" 
                          variant="transparent" 
                          color="violet"
                          onClick={() => updateData({ tags: data.tags.filter(t => t !== tag) })}
                        >
                          ×
                        </ActionIcon>
                      }
                    >
                      {tag}
                    </Badge>
                  ))}
                  {data.tags.length === 0 && <Text size="10px" c="dimmed" ml={4}>No tags assigned yet.</Text>}
                </Group>
              </Stack>
           </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
