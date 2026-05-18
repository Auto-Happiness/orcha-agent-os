import {
  Box,
  Paper,
  Stack,
  Group,
  ActionIcon,
  MultiSelect,
  Checkbox,
  Text,
  Avatar,
  TextInput,
  Textarea,
  Switch,
  Tooltip,
  Loader,
  Select
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustmentsHorizontal,
  IconChevronDown,
  IconArrowRight,
  IconSparkles,
  IconTable
} from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import { MODEL_OPTIONS } from "@/lib/model-options";

interface ChatPromptBoxProps {
  input: string;
  handleInputChange: (e: any) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  allConfigs: any[];
  selectedConfigIds: string[];
  setSelectedConfigIds: (val: string[]) => void;
  aiKeys: any[];
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  showResults: boolean;
  setShowResults: (val: boolean) => void;
}

export function ChatPromptBox({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  allConfigs,
  selectedConfigIds,
  setSelectedConfigIds,
  aiKeys,
  selectedModel,
  setSelectedModel,
  showResults,
  setShowResults,
}: ChatPromptBoxProps) {

  // Defensive local state to ensure typing is ALWAYS fluid
  const [localValue, setLocalValue] = useState(input || "");
  const hasText = !!(localValue && localValue.trim());

  // Background sync for Clearing state (controlled by AI SDK)
  useEffect(() => {
    setLocalValue(input || "");
  }, [input]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    if (typeof handleInputChange === 'function') {
      handleInputChange(e);
    }
  };

  const handleModelChange = (val: string | null) => {
    if (!val) return;
    const provider = val.split(":")[0];
    const hasKey = aiKeys?.some(k => k.provider === provider);
    if (!hasKey && provider !== "local") {
      notifications.show({
        title: "Configuration Error",
        message: "API key not configured for this provider in Settings.",
        color: "red"
      });
    }
    setSelectedModel(val);
  };

  const executeSend = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!isLoading && hasText) {
      // Create a mocked event if called directly via keyboard press
      const submitEvent = e || { preventDefault: () => { } } as any;
      handleSubmit(submitEvent);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeSend();
    }
  };

  return (
    <Box p="md" style={{ background: "transparent" }}>
      <Box component="form" onSubmit={executeSend} style={{ margin: 0 }}>
        <Paper
          radius="lg"
          p="sm"
          style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.1)",
            transition: "all 0.2s ease",
          }}
        >
          <Stack gap="xs">
            <Textarea
              placeholder="Talk to your database"
              variant="unstyled"
              size="md"
              value={localValue}
              autoFocus
              autosize
              minRows={1}
              maxRows={10}
              onChange={handleChange}
              onKeyDown={onKeyDown}
              styles={{
                input: {
                  color: "white",
                  fontSize: "14px",
                  background: "transparent",
                  padding: "8px 4px",
                  minHeight: "unset",
                  lineHeight: "1.5"
                }
              }}
            />

            <Group justify="space-between" align="center">
              <Group gap={8}>
                <MultiSelect
                  data={allConfigs?.map(c => ({ value: c._id, label: c.name })) || []}
                  value={selectedConfigIds}
                  onChange={setSelectedConfigIds}
                  placeholder="Select Databases"
                  variant="unstyled"
                  size="xs"
                  w={220}
                  hidePickedOptions={false}
                  clearable
                  comboboxProps={{ position: 'top-start', width: 320, shadow: 'xl' }}
                  rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                  renderOption={({ option }) => {
                    const config = allConfigs?.find(c => c._id === option.value);
                    const isSelected = selectedConfigIds.includes(option.value);
                    return (
                      <Group gap="sm" wrap="nowrap">
                        <Checkbox
                          checked={isSelected}
                          readOnly
                          size="xs"
                          color="violet"
                          styles={{ input: { cursor: 'pointer' } }}
                        />
                        <Avatar
                          src={config?.image || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"}
                          size={24}
                          radius="xs"
                          style={{ background: "transparent", opacity: 0.8 }}
                        />
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Text size="xs" fw={700} c="white">{option.label}</Text>
                          {config?.description && (
                            <Text size="10px" c="dimmed" style={{ lineHeight: 1.2 }}>
                              {config.description}
                            </Text>
                          )}
                        </Stack>
                      </Group>
                    );
                  }}
                  styles={{
                    root: { width: "220px" },
                    input: {
                      color: "rgba(255,255,255,0.6)",
                      fontWeight: 500,
                      fontSize: "12px",
                      background: "transparent",
                      padding: "0 8px 0 12px"
                    },
                    section: { pointerEvents: "none" as const },
                    dropdown: {
                      background: "#161616",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      padding: "4px"
                    },
                    option: {
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.6)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                    }
                  }}
                />

                <Select
                  data={MODEL_OPTIONS}
                  value={selectedModel}
                  onChange={handleModelChange}
                  variant="unstyled"
                  size="xs"
                  w={180}
                  comboboxProps={{ position: 'top', width: 220, shadow: 'xl' }}
                  leftSection={<IconSparkles size={14} color="rgba(255,255,255,0.4)" />}
                  rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                  styles={{
                    root: { width: "180px" },
                    input: {
                      color: "rgba(255,255,255,0.8)",
                      fontWeight: 500,
                      fontSize: "12px",
                      background: "transparent",
                      padding: "0 8px"
                    },
                    dropdown: {
                      background: "#161616",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    },
                    groupLabel: {
                      color: "rgba(147,51,234,0.8)",
                      fontWeight: 700,
                      fontSize: "10px",
                      letterSpacing: "1px",
                      padding: "8px 12px 4px 12px"
                    },
                    option: {
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.7)",
                      padding: "6px 12px",
                    }
                  }}
                />

                <Tooltip label={showResults ? "Hide result table" : "Show result table"} withArrow position="top">
                  <Group gap={5} align="center">
                    <IconTable size={14} color={showResults ? "#a855f7" : "rgba(255,255,255,0.25)"} />
                    <Switch
                      size="xs"
                      checked={showResults}
                      onChange={(e) => {
                        e.stopPropagation();
                        setShowResults(e.currentTarget.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      color="violet"
                      style={{ cursor: "pointer" }}
                    />
                  </Group>
                </Tooltip>

                <ActionIcon
                  type="submit"
                  radius="xl"
                  size="lg"
                  variant="filled"
                  disabled={!hasText || isLoading}
                  style={{
                    backgroundColor: hasText ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                    color: hasText ? 'white' : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.15s ease-in-out',
                    transform: hasText ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: hasText ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                    cursor: (!hasText || isLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <IconArrowRight size={20} />
                </ActionIcon>
              </Group>
            </Group>
          </Stack>
        </Paper>
      </Box>

      <Text size="10px" ta="center" c="dimmed" py="xs" mt={4} style={{ opacity: 0.5 }}>
        Orcha can make mistakes. Verify important results with the Query Lab.
      </Text>
    </Box>
  );
}
