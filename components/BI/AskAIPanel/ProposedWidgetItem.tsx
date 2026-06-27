import React from "react";
import { Paper, Box, Group, Text, Popover, Tooltip, Badge, Stack, Select, TextInput } from "@mantine/core";
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconNumbers,
  IconTable,
  IconHash,
  IconSettings,
  IconChartArea,
  IconChartRadar,
} from "@tabler/icons-react";
import { ProposedWidget } from "./types";

interface ProposedWidgetItemProps {
  index: number;
  widget: ProposedWidget;
  onChange: (index: number, updatedWidget: ProposedWidget) => void;
}

const commonUnits = ["kg", "lbs", "cm", "m", "%", "pcs"];

export function ProposedWidgetItem({ index, widget, onChange }: ProposedWidgetItemProps) {
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

  const handleFormatTypeChange = (type: string) => {
    const currentMapping = widget.mapping || { labelKey: "", valueKeys: [] };
    let formatVal = "";
    if (type === "currency") {
      formatVal = "USD";
    } else if (type === "unit") {
      formatVal = "kg";
    }
    const updatedMapping = {
      ...currentMapping,
      formatType: type,
      formatValue: formatVal,
    };
    onChange(index, { ...widget, mapping: updatedMapping });
  };

  const handleUnitChange = (unit: string) => {
    const currentMapping = widget.mapping || { labelKey: "", valueKeys: [] };
    const updatedMapping = {
      ...currentMapping,
      formatValue: unit !== "custom" ? unit : "",
    };
    onChange(index, { ...widget, mapping: updatedMapping });
  };

  const handleCustomUnitChange = (val: string) => {
    const currentMapping = widget.mapping || { labelKey: "", valueKeys: [] };
    const updatedMapping = {
      ...currentMapping,
      formatValue: val,
    };
    onChange(index, { ...widget, mapping: updatedMapping });
  };

  const handleMappingFieldChange = (key: string, value: any) => {
    const currentMapping = widget.mapping || { labelKey: "", valueKeys: [] };
    const updatedMapping = {
      ...currentMapping,
      [key]: value,
    };
    onChange(index, { ...widget, mapping: updatedMapping });
  };

  const selectedUnit = getSelectedUnit(widget.mapping);

  const getBorderColor = (type: string) => {
    switch (type) {
      case "line":
        return "#0ea5e9";
      case "bar":
        return "#a855f7";
      case "area":
        return "#6366f1";
      case "pie":
        return "#ec4899";
      case "radar":
        return "#d946ef";
      case "kpi":
        return "#f59e0b";
      case "table":
        return "#10b981";
      default:
        return "#6366f1";
    }
  };

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: "var(--orcha-surface)",
        border: "1px solid var(--orcha-border)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "4px",
          height: "100%",
          background: getBorderColor(widget.type),
        }}
      />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="xs">
          {getIconForType(widget.type)}
          <Text fw={700} size="sm" c="var(--orcha-text-title)">
            {widget.title}
          </Text>
        </Group>
        {widget.type === "counter" && (
          <Popover width={280} position="bottom-end" withArrow shadow="xl" withinPortal trapFocus={false}>
            <Popover.Target>
              <Tooltip label="Design Counter Format" withinPortal>
                <Badge
                  size="xs"
                  color="violet"
                  variant="light"
                  style={{ cursor: "pointer" }}
                  rightSection={<IconSettings size={10} style={{ marginLeft: 2 }} />}
                >
                  Customize Format
                </Badge>
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
                  value={widget.mapping?.formatType || "raw"}
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

                {widget.mapping?.formatType === "currency" && (
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
                    value={widget.mapping?.formatValue || "USD"}
                    onChange={(v) => handleMappingFieldChange("formatValue", v || "USD")}
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

                {widget.mapping?.formatType === "unit" && (
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
                        { value: "%", label: "% (Percentage)" },
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
                        value={widget.mapping?.formatValue || ""}
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
                  value={widget.mapping?.numberFormat || "compact"}
                  onChange={(v) => handleMappingFieldChange("numberFormat", v || "compact")}
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
      </Group>
      <Text size="xs" c="dimmed" mb="md" style={{ lineHeight: 1.4 }}>
        {widget.reason}
      </Text>
    </Paper>
  );
}
