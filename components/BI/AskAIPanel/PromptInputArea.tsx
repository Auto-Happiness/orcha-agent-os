import React from "react";
import { Box, Stack, TextInput, Group, Tooltip, ActionIcon, Text } from "@mantine/core";
import { IconPlus, IconDeviceFloppy, IconSparkles } from "@tabler/icons-react";
import { DatabaseSelector } from "./DatabaseSelector";
import { ModelSelector } from "./ModelSelector";

interface PromptInputAreaProps {
  currentPrompt: string;
  onChangeCurrentPrompt: (val: string) => void;
  draftPromptsCount: number;
  isGenerating: boolean;
  onAddPrompt: () => void;
  onGenerate: () => void;
  allConfigs: any[];
  selectedConfigIds: string[];
  onChangeSelectedConfigIds: (ids: string[]) => void;
  selectedModel: string;
  onChangeSelectedModel: (model: string) => void;
}

export function PromptInputArea({
  currentPrompt,
  onChangeCurrentPrompt,
  draftPromptsCount,
  isGenerating,
  onAddPrompt,
  onGenerate,
  allConfigs,
  selectedConfigIds,
  onChangeSelectedConfigIds,
  selectedModel,
  onChangeSelectedModel,
}: PromptInputAreaProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onGenerate();
      } else {
        e.preventDefault();
        onAddPrompt();
      }
    }
  };

  return (
    <Box
      p="xl"
      style={{
        background: "rgba(13, 10, 26, 0.8)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Stack gap="md">
        <TextInput
          placeholder={draftPromptsCount >= 10 ? "Limit reached (10/10)" : "Describe an insight (e.g. Sales by Region)"}
          size="md"
          value={currentPrompt}
          onChange={(e) => onChangeCurrentPrompt(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating || draftPromptsCount >= 10}
          styles={{
            input: {
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(147, 51, 234, 0.2)",
              color: "white",
              borderRadius: "12px",
              paddingRight: "90px",
            },
          }}
          rightSection={
            <Group gap={6} mr={5}>
              <Tooltip label="Add Insight Draft">
                <ActionIcon
                  color="gray"
                  variant="subtle"
                  radius="md"
                  onClick={onAddPrompt}
                  disabled={!currentPrompt.trim() || draftPromptsCount >= 10}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Generate Dashboard">
                <ActionIcon
                  color="violet"
                  variant="filled"
                  radius="md"
                  size="lg"
                  onClick={onGenerate}
                  loading={isGenerating}
                  disabled={draftPromptsCount === 0 && !currentPrompt.trim()}
                >
                  <IconDeviceFloppy size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          }
          rightSectionWidth={90}
        />

        <Group justify="space-between" align="center">
          <Group gap="sm">
            <DatabaseSelector
              allConfigs={allConfigs}
              selectedConfigIds={selectedConfigIds}
              onChangeSelectedConfigIds={onChangeSelectedConfigIds}
            />

            <ModelSelector selectedModel={selectedModel} onChangeSelectedModel={onChangeSelectedModel} />
          </Group>

          <Group gap={4}>
            <IconSparkles size={10} color="#a855f7" />
            <Text size="10px" c="dimmed">
              {draftPromptsCount}/10 Insights
            </Text>
          </Group>
        </Group>
      </Stack>
    </Box>
  );
}
