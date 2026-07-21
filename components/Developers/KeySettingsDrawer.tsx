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
  Select,
  MultiSelect,
  Checkbox,
  Avatar,
  rem
} from "@mantine/core";
import { useState, useEffect } from "react";
import { IconSettings, IconPlus, IconTrash, IconRobot, IconDatabase, IconSparkles, IconChevronDown } from "@tabler/icons-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { notifications } from "@mantine/notifications";
import { MODEL_OPTIONS } from "@/lib/model-options";

interface KeySettingsDrawerProps {
  opened: boolean;
  onClose: () => void;
  apiKey: any;
}

export function KeySettingsDrawer({ opened, onClose, apiKey }: KeySettingsDrawerProps) {
  const [origins, setOrigins] = useState<string[]>([""]);
  const [rateLimit, setRateLimit] = useState<number>(60);
  const [defaultModelId, setDefaultModelId] = useState<string | null>("gemini:gemini-1.5-flash");
  const [defaultConfigIds, setDefaultConfigIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const updateKeySettings = useMutation(api.apiKeys.updateSettings);

  // Fetch available database configurations for the organization
  const databaseConfigs = useQuery(api.databaseConfigs.listByOrganization,
    apiKey ? { organizationId: apiKey.organizationId } : "skip"
  );

  // Reset state when drawer opens/key changes
  useEffect(() => {
    if (opened && apiKey) {
      setOrigins(apiKey.corsOrigins?.length > 0 ? apiKey.corsOrigins : [""]);
      setRateLimit(apiKey.rateLimit || 60);
      setDefaultModelId(apiKey.defaultModelId || "gemini:gemini-1.5-flash");
      setDefaultConfigIds(apiKey.defaultConfigIds || (apiKey.defaultConfigId ? [apiKey.defaultConfigId] : []));
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
        rateLimit: rateLimit,
        defaultModelId: defaultModelId as any,
        defaultConfigIds: defaultConfigIds as any
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

  const configOptions = databaseConfigs?.map(c => ({
    label: c.name,
    value: c._id
  })) || [];

  const selectedConfig = defaultConfigIds.length === 1
    ? databaseConfigs?.find(c => c._id === defaultConfigIds[0])
    : null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSettings size={18} color="#a855f7" />
          <Text fw={700} c="var(--orcha-text-title)">Key Settings: {apiKey?.name}</Text>
        </Group>
      }
      position="right"
      size="lg"
      styles={{
        content: { background: "var(--orcha-panel)", borderLeft: "1px solid var(--orcha-border)" },
        header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)" },
      }}
    >
      <Stack gap="xl" p="md">
        <Box>
          <Text size="sm" fw={600} c="var(--orcha-text-title)" mb={4}>Default AI Model</Text>
          <Text size="xs" c="dimmed" mb="md">
            Choose which AI model this key should use by default. You can still override this per-request using the `modelId` parameter.
          </Text>
          <Select
            data={MODEL_OPTIONS}
            value={defaultModelId}
            onChange={setDefaultModelId}
            placeholder="Select model"
            leftSection={<IconSparkles size={16} color="#a855f7" />}
            styles={{
              input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" },
              dropdown: { background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" },
              option: { color: "var(--orcha-text-title)" },
              groupLabel: { color: "var(--orcha-purple)", fontWeight: 700, fontSize: "10px", letterSpacing: "1px" }
            }}
          />
        </Box>

        <Divider color="var(--orcha-border)" />

        <Box>
          <Text size="sm" fw={600} c="var(--orcha-text-title)" mb={4}>Default Data Sources</Text>
          <Text size="xs" c="dimmed" mb="md">
            Pin this API key to one or more database configurations.
            Requests using this key won't need to specify `configId` or `configIds` if these are set.
          </Text>
          <MultiSelect
            data={configOptions}
            value={defaultConfigIds}
            onChange={setDefaultConfigIds}
            placeholder="Select database configurations"
            clearable
            searchable
            hidePickedOptions={false}
            leftSection={
              selectedConfig ? (
                <Avatar
                  src={selectedConfig.image || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"}
                  size={16}
                  radius="xs"
                />
              ) : (
                <IconDatabase size={16} color="#a855f7" />
              )
            }
            renderOption={({ option, checked }) => {
              const config = databaseConfigs?.find(c => c._id === option.value);
              return (
                <Group gap="sm" wrap="nowrap" style={{ width: "100%" }}>
                  <Checkbox
                    checked={checked}
                    readOnly
                    size="xs"
                    color="violet"
                    styles={{
                      input: {
                        borderColor: "var(--orcha-border)",
                        backgroundColor: checked ? "#a855f7" : "transparent",
                      }
                    }}
                  />
                  <Avatar
                    src={config?.image || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"}
                    size={20}
                    radius="xs"
                    style={{ background: "transparent" }}
                  />
                  <Text size="xs" fw={500} style={{ flex: 1 }}>{option.label}</Text>
                </Group>
              );
            }}
            styles={{
              input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" },
              dropdown: { background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" },
              option: { color: "var(--orcha-text-title)" },
              pill: { background: "var(--orcha-sidebar-hover-bg)", color: "var(--orcha-purple)", border: "1px solid var(--orcha-border)" }
            }}
          />
        </Box>

        <Divider color="var(--orcha-border)" />

        <Box>
          <Text size="sm" fw={600} c="var(--orcha-text-title)" mb={4}>Rate Limiting</Text>
          <Text size="xs" c="dimmed" mb="md">
            Configure how many requests this specific key can make per minute.
          </Text>
          <NumberInput
            label="Requests per minute"
            value={rateLimit}
            onChange={(val) => setRateLimit(Number(val))}
            min={10}
            max={60}
            styles={{
              input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" },
              label: { color: "var(--orcha-text-title)", fontSize: rem(11), marginBottom: 4 }
            }}
          />
        </Box>

        <Divider color="var(--orcha-border)" />

        <Box>
          <Text size="sm" fw={600} c="var(--orcha-text-title)" mb={4}>CORS Policy</Text>
          <Text size="xs" c="dimmed" mb="md">
            Restrict this key to specific domains.
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
                    error={isInvalid ? "Invalid origin URL" : null}
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        background: "var(--orcha-surface)",
                        borderColor: isInvalid ? "rgba(250, 82, 82, 0.5)" : "var(--orcha-border)",
                        color: "var(--orcha-text-title)"
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


        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button color="violet" onClick={handleSave} loading={isSaving}>Save Changes</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
