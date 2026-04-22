"use client";

import React, { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  UnstyledButton,
  SimpleGrid,
  ThemeIcon,
  TextInput,
  rem,
  Box,
  Paper
} from "@mantine/core";
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconCircleNumber1,
  IconCheck,
  IconChevronRight
} from "@tabler/icons-react";

interface AddWidgetWizardProps {
  opened: boolean;
  onClose: () => void;
  onAdd: (widget: any) => void;
}

const WIDGET_TYPES = [
  { id: "bar", title: "Bar Chart", description: "Compare quantities across categories", icon: IconChartBar, color: "blue" },
  { id: "line", title: "Line Chart", description: "Visualize trends over time", icon: IconChartLine, color: "violet" },
  { id: "pie", title: "Pie Chart", description: "Show proportions of a whole", icon: IconChartPie, color: "orange" },
  { id: "kpi", title: "KPI Metric", description: "A single important number", icon: IconCircleNumber1, color: "cyan" },
];

export function AddWidgetWizard({ opened, onClose, onAdd }: AddWidgetWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const handleAdd = () => {
    if (!selectedType) return;

    onAdd({
      type: selectedType,
      title: title || `New ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`,
      layout: { x: 0, y: 0, w: selectedType === "kpi" ? 3 : 6, h: selectedType === "kpi" ? 2 : 4 },
    });

    // Reset and close
    setStep(1);
    setSelectedType(null);
    setTitle("");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>Add New Insight</Text>}
      size="lg"
      radius="lg"
      styles={{
        content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)" },
        header: { background: "#130f22", color: "white" },
      }}
    >
      {step === 1 && (
        <Stack>
          <Text size="sm" c="dimmed">Choose the type of visualization you want to add to your dashboard.</Text>
          <SimpleGrid cols={2} spacing="md">
            {WIDGET_TYPES.map((item) => (
              <UnstyledButton
                key={item.id}
                onClick={() => {
                  setSelectedType(item.id);
                  setStep(2);
                }}
                p="md"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: rem(12),
                  transition: "all 0.2s ease",
                }}
                className="hover:bg-white/5 hover:border-violet-500/50"
              >
                <Group wrap="nowrap">
                  <ThemeIcon size={40} radius="md" color={item.color} variant="light">
                    <item.icon size={24} />
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600} c="white">{item.title}</Text>
                    <Text size="xs" c="dimmed">{item.description}</Text>
                  </Box>
                  <IconChevronRight size={16} color="rgba(255,255,255,0.2)" />
                </Group>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {step === 2 && (
        <Stack>
          <Text size="sm" c="dimmed">Give your widget a name and configure the data source (Data mapping coming soon).</Text>

          <TextInput
            label="Widget Title"
            placeholder="e.g. Monthly Revenue Trend"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            styles={{
              input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
              label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }
            }}
          />

          <Paper p="md" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}>
            <Text size="xs" c="dimmed" ta="center">Data Source Configuration will follow after UI approval.</Text>
          </Paper>

          <Group justify="space-between" mt="xl">
            <Button variant="subtle" color="gray" onClick={() => setStep(1)}>Back</Button>
            <Button
              color="violet"
              leftSection={<IconCheck size={16} />}
              onClick={handleAdd}
            >
              Add to Dashboard
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
