import React from "react";
import { Paper, Group, Badge, Text, Menu, Button, Popover, Tooltip, ActionIcon, Stack, Select, TextInput } from "@mantine/core";
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconNumbers,
  IconTable,
  IconHash,
  IconSettings,
  IconX,
  IconChartArea,
  IconChartRadar,
} from "@tabler/icons-react";
import { DraftPrompt } from "./types";

interface DraftPromptItemProps {
  index: number;
  draft: DraftPrompt;
  onRemove: (index: number) => void;
  onChange: (index: number, updatedDraft: DraftPrompt) => void;
}

const commonUnits = ["kg", "lbs", "cm", "m", "%", "pcs"];

export function DraftPromptItem({ index, draft, onRemove, onChange }: DraftPromptItemProps) {
  const getSelectedUnit = (mappingOrDraft: any) => {
    const val = mappingOrDraft?.formatValue || "";
    if (mappingOrDraft?.formatType === "unit") {
      return commonUnits.includes(val) ? val : val ? "custom" : "kg";
    }
    return "kg";
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "bar":
        return <IconChartBar size={18} color="#a855f7" />;
      case "line":
        return <IconChartLine size={18} color="#0ea5e9" />;
      case "area":
        return <IconChartArea size={18} color="#6366f1" />;
      case "pie":
        return <IconChartPie size={18} color="#ec4899" />;
      case "radar":
        return <IconChartRadar size={18} color="#d946ef" />;
      case "kpi":
        return <IconNumbers size={18} color="#f59e0b" />;
      case "table":
        return <IconTable size={18} color="#10b981" />;
      case "counter":
        return <IconHash size={18} color="#6366f1" />;
      default:
        return <IconChartBar size={18} />;
    }
  };

  const handleTypeChange = (type: string) => {
    const updated = { ...draft, type };
    if (type === "counter") {
      updated.formatType = draft.formatType || "raw";
      updated.numberFormat = draft.numberFormat || "compact";
    }
    onChange(index, updated);
  };

  const handleFormatTypeChange = (type: string) => {
    const updated = { ...draft, formatType: type };
    if (type === "currency") {
      updated.formatValue = "USD";
    } else if (type === "unit") {
      updated.formatValue = "kg";
    } else {
      updated.formatValue = "";
    }
    onChange(index, updated);
  };

  const handleUnitChange = (unit: string) => {
    const updated = { ...draft, formatValue: unit !== "custom" ? unit : "" };
    onChange(index, updated);
  };

  const handleCustomUnitChange = (val: string) => {
    const updated = { ...draft, formatValue: val };
    onChange(index, updated);
  };

  const handleNumberFormatChange = (numberFormat: string) => {
    const updated = { ...draft, numberFormat };
    onChange(index, updated);
  };

  const selectedUnit = getSelectedUnit(draft);

  return (
    <Paper
      p="xs"
      radius="md"
      style={{ background: "var(--orcha-sidebar-hover-bg)", border: "1px solid var(--orcha-border)" }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Badge color="violet" variant="filled" size="xs">
            {index + 1}
          </Badge>
          <Text size="xs" c="var(--orcha-text-title)" lineClamp={1} style={{ flex: 1 }}>
            {draft.text}
          </Text>
        </Group>
        <Group gap={4}>
          <Menu position="bottom-end" shadow="md" width={140}>
            <Menu.Target>
              <Button
                variant="subtle"
                size="compact-xs"
                color="gray"
                leftSection={getIconForType(draft.type || "bar")}
                styles={{ section: { marginRight: 4 } }}
              >
                {(draft.type || "bar").charAt(0).toUpperCase() + (draft.type || "bar").slice(1)}
              </Button>
            </Menu.Target>
            <Menu.Dropdown bg="var(--orcha-panel)" style={{ border: "1px solid var(--orcha-border)" }}>
              <Menu.Label>Insight Type</Menu.Label>
              <Menu.Item
                leftSection={<IconChartBar size={14} color="#a855f7" />}
                onClick={() => handleTypeChange("bar")}
                c="var(--orcha-text-title)"
              >
                Bar Chart
              </Menu.Item>
              <Menu.Item
                leftSection={<IconChartLine size={14} color="#0ea5e9" />}
                onClick={() => handleTypeChange("line")}
                c="var(--orcha-text-title)"
              >
                Line Chart
              </Menu.Item>
              <Menu.Item
                leftSection={<IconChartArea size={14} color="#6366f1" />}
                onClick={() => handleTypeChange("area")}
                c="var(--orcha-text-title)"
              >
                Area Chart
              </Menu.Item>
              <Menu.Item
                leftSection={<IconChartPie size={14} color="#ec4899" />}
                onClick={() => handleTypeChange("pie")}
                c="var(--orcha-text-title)"
              >
                Pie Chart
              </Menu.Item>
              <Menu.Item
                leftSection={<IconChartRadar size={14} color="#d946ef" />}
                onClick={() => handleTypeChange("radar")}
                c="var(--orcha-text-title)"
              >
                Radar Chart
              </Menu.Item>
              <Menu.Item
                leftSection={<IconNumbers size={14} color="#f59e0b" />}
                onClick={() => handleTypeChange("kpi")}
                c="var(--orcha-text-title)"
              >
                KPI Metric
              </Menu.Item>
              <Menu.Item
                leftSection={<IconTable size={14} color="#10b981" />}
                onClick={() => handleTypeChange("table")}
                c="var(--orcha-text-title)"
              >
                Data Table
              </Menu.Item>
              <Menu.Item
                leftSection={<IconHash size={14} color="#6366f1" />}
                onClick={() => handleTypeChange("counter")}
                c="var(--orcha-text-title)"
              >
                Smart Counter
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {draft.type === "counter" && (
            <Popover width={280} position="bottom-end" withArrow shadow="xl" withinPortal trapFocus={false}>
              <Popover.Target>
                <Tooltip label="Design Counter Format" withinPortal>
                  <ActionIcon variant="light" color="violet" size="xs" radius="md">
                    <IconSettings size={12} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown bg="var(--orcha-panel)" style={{ border: "1px solid var(--orcha-border)", padding: 12 }}>
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="var(--orcha-purple)" mb={4}>
                    Smart Counter Design
                  </Text>

                  <Select
                    label="Format Type"
                    size="xs"
                    comboboxProps={{ withinPortal: false }}
                    data={[
                      { value: "raw", label: "Raw Number" },
                      { value: "currency", label: "Currency" },
                      { value: "unit", label: "Measurement Unit" },
                    ]}
                    value={draft.formatType || "raw"}
                    onChange={(v) => handleFormatTypeChange(v || "raw")}
                    styles={{
                      label: { color: "var(--orcha-text-body)", fontSize: 10, marginBottom: 2 },
                      input: {
                        background: "var(--orcha-surface)",
                        color: "var(--orcha-text-title)",
                        border: "1px solid var(--orcha-border)",
                      },
                      dropdown: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
                      option: { color: "var(--orcha-text-title)" },
                    }}
                  />

                  {draft.formatType === "currency" && (
                    <Select
                      label="Currency"
                      size="xs"
                      comboboxProps={{ withinPortal: false }}
                      data={[
                        { value: "USD", label: "USD ($)" },
                        { value: "PHP", label: "PHP (₱)" },
                        { value: "EUR", label: "EUR (€)" },
                        { value: "CNY", label: "CNY (¥)" },
                        { value: "JPY", label: "JPY (¥)" },
                      ]}
                      value={draft.formatValue || "USD"}
                      onChange={(v) => onChange(index, { ...draft, formatValue: v || "USD" })}
                      styles={{
                        label: { color: "var(--orcha-text-body)", fontSize: 10, marginBottom: 2 },
                        input: {
                          background: "var(--orcha-surface)",
                          color: "var(--orcha-text-title)",
                          border: "1px solid var(--orcha-border)",
                        },
                        dropdown: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
                        option: { color: "var(--orcha-text-title)" },
                      }}
                    />
                  )}

                  {draft.formatType === "unit" && (
                    <Stack gap="xs">
                      <Select
                        label="Unit"
                        size="xs"
                        comboboxProps={{ withinPortal: false }}
                        data={[
                          { value: "kg", label: "kg (Weight - Kilograms)" },
                          { value: "lbs", label: "lbs (Weight - Pounds)" },
                          { value: "cm", label: "cm (Height - Centimeters)" },
                          { value: "m", label: "m (Height - Meters)" },
                          { value: "%", label: "(Percentage) %" },
                          { value: "pcs", label: "pcs (Pieces)" },
                          { value: "custom", label: "Custom Suffix..." },
                        ]}
                        value={selectedUnit}
                        onChange={(v) => handleUnitChange(v || "kg")}
                        styles={{
                          label: { color: "var(--orcha-text-body)", fontSize: 10, marginBottom: 2 },
                          input: {
                            background: "var(--orcha-surface)",
                            color: "var(--orcha-text-title)",
                            border: "1px solid var(--orcha-border)",
                          },
                          dropdown: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
                          option: { color: "var(--orcha-text-title)" },
                        }}
                      />
                      {selectedUnit === "custom" && (
                        <TextInput
                          label="Custom Suffix"
                          size="xs"
                          placeholder="e.g. pixels, points"
                          value={draft.formatValue || ""}
                          onChange={(e) => handleCustomUnitChange(e.currentTarget.value)}
                          styles={{
                            label: { color: "var(--orcha-text-body)", fontSize: 10, marginBottom: 2 },
                            input: {
                              background: "var(--orcha-surface)",
                              color: "var(--orcha-text-title)",
                              border: "1px solid var(--orcha-border)",
                            },
                          }}
                        />
                      )}
                    </Stack>
                  )}

                  <Select
                    label="Number Style"
                    size="xs"
                    comboboxProps={{ withinPortal: false }}
                    data={[
                      { value: "compact", label: "Abbreviated (e.g. 11k)" },
                      { value: "decimal", label: "Decimal (e.g. 11,000.00)" },
                      { value: "integer", label: "Integer (e.g. 11,000)" },
                    ]}
                    value={draft.numberFormat || "compact"}
                    onChange={(v) => handleNumberFormatChange(v || "compact")}
                    styles={{
                      label: { color: "var(--orcha-text-body)", fontSize: 10, marginBottom: 2 },
                      input: {
                        background: "var(--orcha-surface)",
                        color: "var(--orcha-text-title)",
                        border: "1px solid var(--orcha-border)",
                      },
                      dropdown: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
                      option: { color: "var(--orcha-text-title)" },
                    }}
                  />
                </Stack>
              </Popover.Dropdown>
            </Popover>
          )}
          <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => onRemove(index)}>
            <IconX size={12} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}
