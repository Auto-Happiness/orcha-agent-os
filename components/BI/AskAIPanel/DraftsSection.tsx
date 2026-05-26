import React from "react";
import { Stack, Box, Avatar, Text } from "@mantine/core";
import { IconRobot } from "@tabler/icons-react";
import { DraftPrompt } from "./types";
import { DraftPromptItem } from "./DraftPromptItem";

interface DraftsSectionProps {
  draftPrompts: DraftPrompt[];
  onRemoveDraftPrompt: (index: number) => void;
  onChangeDraftPrompt: (index: number, updatedDraft: DraftPrompt) => void;
}

export function DraftsSection({
  draftPrompts,
  onRemoveDraftPrompt,
  onChangeDraftPrompt,
}: DraftsSectionProps) {
  return (
    <Stack gap="xl">
      <Box py={20} ta="center">
        <Avatar
          size={64}
          radius="xl"
          mx="auto"
          mb="md"
          styles={{
            root: {
              background: "rgba(147, 51, 234, 0.1)",
              border: "2px solid rgba(147, 51, 234, 0.2)",
            },
          }}
        >
          <IconRobot size={32} color="#a855f7" />
        </Avatar>
        <Text fw={700} size="lg" c="white">
          Insight Architect
        </Text>
        <Text size="xs" c="dimmed">
          {" "}
          Draft up to 10 widgets. I&apos;ll build the full dashboard.
        </Text>
      </Box>

      {draftPrompts.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={800} c="dimmed" style={{ letterSpacing: "1px" }}>
            DRAFT INSIGHTS ({draftPrompts.length}/10)
          </Text>
          {draftPrompts.map((p, i) => (
            <DraftPromptItem
              key={i}
              index={i}
              draft={p}
              onRemove={onRemoveDraftPrompt}
              onChange={onChangeDraftPrompt}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
