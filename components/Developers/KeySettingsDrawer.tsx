import { 
  Drawer, 
  Stack, 
  Group, 
  Text, 
  Box, 
  NumberInput, 
  Divider, 
  Textarea, 
  Badge, 
  Button, 
  rem 
} from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";

interface KeySettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  apiKey: any;
}

export function KeySettingsDrawer({ opened, onClose, apiKey }: KeySettingsDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSettings size={18} color="#a855f7" />
          <Text fw={700} c="white">Key Settings: {apiKey?.name}</Text>
        </Group>
      }
      position="right"
      size="lg"
      styles={{
        content: { background: "#0c0814", borderLeft: "1px solid rgba(147,51,234,0.1)" },
        header: { background: "#0c0814", borderBottom: "1px solid rgba(255,255,255,0.05)" },
      }}
    >
      <Stack gap="xl" p="md">
        <Box>
          <Text size="sm" fw={600} c="white" mb={4}>Rate Limiting</Text>
          <Text size="xs" c="dimmed" mb="md">
            Configure how many requests this specific key can make per minute. 
            Overrides the organization-wide default.
          </Text>
          <NumberInput
            label="Requests per minute"
            defaultValue={60}
            min={1}
            styles={{
              input: { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "white" },
              label: { color: "rgba(255,255,255,0.5)", fontSize: rem(11), marginBottom: 4 }
            }}
          />
        </Box>

        <Divider color="rgba(255,255,255,0.05)" />

        <Box>
          <Text size="sm" fw={600} c="white" mb={4}>CORS Policy</Text>
          <Text size="xs" c="dimmed" mb="md">
            Restrict this key to specific domains. Enter one domain per line 
            (e.g., https://myapp.com). Leave empty to allow all origins.
          </Text>
          <Textarea
            placeholder="https://example.com&#10;https://staging.example.com"
            minRows={4}
            styles={{
              input: { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "white" }
            }}
          />
        </Box>

        <Box>
          <Badge color="violet" variant="light">Enterprise Feature</Badge>
          <Text size="xs" c="dimmed" mt={4}>
            Advanced security policies are applied instantly to all incoming traffic using this credential.
          </Text>
        </Box>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button color="violet" onClick={onClose}>Save Changes</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
