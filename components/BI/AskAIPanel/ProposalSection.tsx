import React from "react";
import { Stack, Group, Text, Badge, Button } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { ProposedWidget } from "./types";
import { ProposedWidgetItem } from "./ProposedWidgetItem";

interface ProposalSectionProps {
  proposedWidgets: ProposedWidget[];
  onChangeProposedWidget: (index: number, updatedWidget: ProposedWidget) => void;
  onDeploy: () => void;
  isSaving: boolean;
  onDiscard: () => void;
}

export function ProposalSection({
  proposedWidgets,
  onChangeProposedWidget,
  onDeploy,
  isSaving,
  onDiscard,
}: ProposalSectionProps) {
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Text size="xs" fw={800} c="dimmed" style={{ letterSpacing: "1px" }}>
          AI ARCHITECT PROPOSAL
        </Text>
        <Badge color="green" variant="light">
          {proposedWidgets.length} Widgets Ready
        </Badge>
      </Group>

      {proposedWidgets.map((widget, index) => (
        <ProposedWidgetItem
          key={widget.id}
          index={index}
          widget={widget}
          onChange={onChangeProposedWidget}
        />
      ))}

      <Button
        fullWidth
        size="md"
        color="violet"
        mt="xl"
        leftSection={<IconCheck size={18} />}
        onClick={onDeploy}
        loading={isSaving}
        disabled={isSaving}
        style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)" }}
      >
        Confirm & Deploy Dashboard
      </Button>
      <Button variant="subtle" color="gray" fullWidth size="sm" onClick={onDiscard}>
        Discard & Restart
      </Button>
    </Stack>
  );
}
