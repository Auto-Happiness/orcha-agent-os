import React, { useState, useEffect } from "react";
import { Drawer, Stack, Group, Text, Box, TextInput, Textarea, Button } from "@mantine/core";
import { IconChartBar } from "@tabler/icons-react";

interface TextBoxConfigSectionProps {
  opened: boolean;
  onClose: () => void;
  widget: any;
  mode: "create" | "edit";
  onSave?: (widgetData: any) => void;
}

export function TextBoxConfigSection({ opened, onClose, widget, mode, onSave }: TextBoxConfigSectionProps) {
  const [widgetTitle, setWidgetTitle] = useState(widget?.title || "");
  const [textContent, setTextContent] = useState(widget?.description || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setWidgetTitle(widget?.title || "");
      setTextContent(widget?.description || "");
      setIsSaving(false);
    }
  }, [opened, widget]);

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave({
          ...widget,
          title: widgetTitle || "Text Box",
          description: textContent,
          queryId: undefined,
          mapping: undefined,
          status: "configured",
        });
        onClose();
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group gap="xs">
          <IconChartBar size={20} color="#a855f7" />
          <Text fw={800} size="lg">Text Box Configuration</Text>
        </Group>
      }
      padding="xl"
      styles={{
        content: {
          background: "var(--orcha-panel)",
          borderLeft: "1px solid var(--orcha-border)",
          color: "var(--orcha-text-title)"
        },
        header: {
          background: "var(--orcha-panel)",
          color: "var(--orcha-text-title)",
          borderBottom: "1px solid var(--orcha-border)",
          paddingBottom: 20
        },
      }}
    >
      <Stack gap="xl" mt="md">
        <Box>
          <Text size="sm" c="dimmed" mb="lg">
            Add contextual guidance, business rules, or notes to your dashboard.
          </Text>
          <Stack gap="md">
            <TextInput
              label="Component Title"
              placeholder="e.g. Executive Notes"
              value={widgetTitle}
              onChange={(e) => setWidgetTitle(e.currentTarget.value)}
              styles={{
                label: { color: "var(--orcha-text-title)", marginBottom: 8 },
                input: { background: "var(--orcha-surface)", border: "1px solid var(--orcha-border)", color: "var(--orcha-text-title)" }
              }}
            />
            <Textarea
              label="Text Content"
              placeholder="Add explanatory notes, business context, assumptions, and guidance..."
              minRows={12}
              autosize
              value={textContent}
              onChange={(e) => setTextContent(e.currentTarget.value)}
              styles={{
                label: { color: "var(--orcha-text-title)", marginBottom: 8 },
                input: { background: "var(--orcha-surface)", border: "1px solid var(--orcha-border)", color: "var(--orcha-text-title)" }
              }}
            />
          </Stack>
        </Box>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button
            color="violet"
            size="md"
            loading={isSaving}
            style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)" }}
            onClick={handleSave}
          >
            {mode === "create" ? "Add to Dashboard" : "Apply Settings"}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
