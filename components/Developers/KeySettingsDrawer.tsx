import { 
  Drawer, 
  Stack, 
  Group, 
  Text, 
  Box, 
  NumberInput, 
  Divider, 
  TextInput, 
  ActionIcon,
  Badge, 
  Button, 
  rem 
} from "@mantine/core";
import { useState, useEffect } from "react";
import { IconSettings, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { notifications } from "@mantine/notifications";

interface KeySettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  apiKey: any;
}

export function KeySettingsDrawer({ opened, onClose, apiKey }: KeySettingsDrawerProps) {
  const [origins, setOrigins] = useState<string[]>([""]);
  const [rateLimit, setRateLimit] = useState<number>(60);
  const [isSaving, setIsSaving] = useState(false);
  const updateKeySettings = useMutation(api.apiKeys.updateSettings);

  // Reset state when drawer opens/key changes
  useEffect(() => {
    if (opened && apiKey) {
      setOrigins(apiKey.corsOrigins?.length > 0 ? apiKey.corsOrigins : [""]);
      setRateLimit(apiKey.rateLimit || 60);
    }
  }, [opened, apiKey]);

  const addOrigin = () => setOrigins([...origins, ""]);
  const removeOrigin = (index: number) => {
    const newOrigins = origins.filter((_, i) => i !== index);
    setOrigins(newOrigins.length ? newOrigins : [""]);
  };
  const updateOrigin = (index: number, value: string) => {
    const newOrigins = [...origins];
    newOrigins[index] = value;
    setOrigins(newOrigins);
  };

  const handleSave = async () => {
    if (!apiKey) return;

    const ORIGIN_REGEX = /^https?:\/\/(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})(?::\d{1,5})?$/;
    const hasInvalid = origins.some(o => o !== "" && !ORIGIN_REGEX.test(o));

    if (hasInvalid) {
      notifications.show({
        title: "Validation Error",
        message: "Please ensure all origins are valid URLs (e.g., https://example.com).",
        color: "red",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Filter out empty strings from origins
      const filteredOrigins = origins.filter(o => o.trim() !== "");
      
      await updateKeySettings({
        id: apiKey._id,
        corsOrigins: filteredOrigins,
        rateLimit: rateLimit
      });

      notifications.show({
        title: "Settings Saved",
        message: `API Key "${apiKey.name}" has been updated.`,
        color: "green",
      });
      onClose();
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to update key settings.",
        color: "red",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
            value={rateLimit}
            onChange={(val) => setRateLimit(Number(val))}
            min={10}
            max={60}
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
            Restrict this key to specific domains. Applications from these 
            origins will be allowed to access the API.
          </Text>
          
          <Stack gap="xs">
            {origins.map((origin, index) => {
              const ORIGIN_REGEX = /^https?:\/\/(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})(?::\d{1,5})?$/;
              const isInvalid = origin !== "" && !ORIGIN_REGEX.test(origin);
              
              return (
                <Group key={index} gap="xs" align="flex-start">
                  <TextInput
                    placeholder="https://example.com"
                    value={origin}
                    onChange={(e) => updateOrigin(index, e.currentTarget.value)}
                    error={isInvalid ? "Invalid origin URL (e.g. https://example.com)" : null}
                    style={{ flex: 1 }}
                    styles={{
                      input: { 
                        background: "rgba(255,255,255,0.03)", 
                        borderColor: isInvalid ? "rgba(250, 82, 82, 0.5)" : "rgba(255,255,255,0.1)", 
                        color: "white" 
                      },
                      error: { fontSize: rem(10), marginTop: 4 }
                    }}
                  />
                  <ActionIcon 
                    variant="subtle" 
                    color="red" 
                    onClick={() => removeOrigin(index)}
                    disabled={origins.length === 1 && !origins[0]}
                    mt={4}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              );
            })}
            <Button 
              variant="subtle" 
              color="violet" 
              size="xs" 
              leftSection={<IconPlus size={14} />}
              onClick={addOrigin}
              style={{ alignSelf: "flex-start" }}
            >
              Add Origin
            </Button>
          </Stack>
        </Box>

        <Box>
          <Badge color="violet" variant="light">Enterprise Feature</Badge>
          <Text size="xs" c="dimmed" mt={4}>
            Advanced security policies are applied instantly to all incoming traffic using this credential.
          </Text>
        </Box>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button color="violet" onClick={handleSave} loading={isSaving}>Save Changes</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
