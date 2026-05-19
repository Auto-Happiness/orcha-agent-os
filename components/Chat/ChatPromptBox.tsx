import {
  Box,
  Paper,
  Stack,
  Group,
  ActionIcon,
  Checkbox,
  Text,
  Avatar,
  TextInput,
  Textarea,
  Switch,
  Tooltip,
  Loader,
  Select,
  Menu
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
                <Menu 
                  closeOnItemClick={false} 
                  position="top-start" 
                  width={320} 
                  shadow="xl"
                  styles={{
                    dropdown: {
                      background: "#161616",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      padding: "4px"
                    },
                    item: {
                      padding: "8px 12px",
                      borderRadius: "6px",
                      color: "white",
                      "&:hover": {
                        background: "rgba(255,255,255,0.05)"
                      }
                    }
                  }}
                >
                  <Menu.Target>
                    <Group 
                      gap={6} 
                      px="sm" 
                      py={6} 
                      style={{ 
                        cursor: "pointer", 
                        borderRadius: "8px", 
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.02)",
                        height: "32px",
                        minWidth: "150px",
                        transition: "all 0.15s ease"
                      }}
                      className="db-select-pill-hover"
                    >
                      <style jsx>{`
                        .db-select-pill-hover:hover {
                          background: rgba(255,255,255,0.06) !important;
                          border-color: rgba(255,255,255,0.2) !important;
                        }
                      `}</style>
                      <IconTable size={14} color="rgba(255,255,255,0.4)" />
                      <Text size="xs" fw={600} c="rgba(255,255,255,0.8)" style={{ flex: 1 }}>
                        {selectedConfigIds.length === 0 
                          ? "Select Databases" 
                          : `${selectedConfigIds.length} DB${selectedConfigIds.length > 1 ? "s" : ""} Selected`}
                      </Text>
                      <IconChevronDown size={10} color="rgba(255,255,255,0.4)" />
                    </Group>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label c="dimmed" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Target Databases
                    </Menu.Label>
                    {allConfigs?.map((config) => {
                      const isSelected = selectedConfigIds.includes(config._id);
                      return (
                        <Menu.Item
                          key={config._id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedConfigIds(selectedConfigIds.filter(id => id !== config._id));
                            } else {
                              setSelectedConfigIds([...selectedConfigIds, config._id]);
                            }
                          }}
                        >
                          <Group gap="sm" wrap="nowrap" style={{ width: "100%" }}>
                            <Checkbox
                              checked={isSelected}
                              readOnly
                              size="xs"
                              color="violet"
                              styles={{ input: { cursor: 'pointer' } }}
                            />
                            <Avatar
                              src={config.image || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"}
                              size={24}
                              radius="xs"
                              style={{ background: "transparent", opacity: 0.8 }}
                            />
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text size="xs" fw={700} c="white">{config.name}</Text>
                              {config.description && (
                                <Text size="10px" c="dimmed" style={{ lineHeight: 1.2 }}>
                                  {config.description}
                                </Text>
                              )}
                            </Stack>
                          </Group>
                        </Menu.Item>
                      );
                    })}
                  </Menu.Dropdown>
                </Menu>

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
