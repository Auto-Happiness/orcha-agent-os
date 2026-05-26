import React from "react";
import { Box, Group, Text, Stack, Alert, Select, TextInput, MultiSelect } from "@mantine/core";
import { IconSettings, IconInfoCircle } from "@tabler/icons-react";

interface ColumnMappingSectionProps {
  widgetType: string;
  discoveredColumns: string[];
  labelKey: string;
  onChangeLabelKey: (val: string) => void;
  valueKeys: string[];
  onChangeValueKeys: (keys: string[]) => void;
  formatType: string;
  onChangeFormatType: (val: string) => void;
  formatValue: string;
  onChangeFormatValue: (val: string) => void;
  selectedUnit: string;
  onChangeSelectedUnit: (val: string) => void;
  numberFormat: string;
  onChangeNumberFormat: (val: string) => void;
}

export function ColumnMappingSection({
  widgetType,
  discoveredColumns,
  labelKey,
  onChangeLabelKey,
  valueKeys,
  onChangeValueKeys,
  formatType,
  onChangeFormatType,
  formatValue,
  onChangeFormatValue,
  selectedUnit,
  onChangeSelectedUnit,
  numberFormat,
  onChangeNumberFormat,
}: ColumnMappingSectionProps) {
  const handleFormatTypeChange = (v: string | null) => {
    const val = v || "raw";
    onChangeFormatType(val);
    if (val === "currency") {
      onChangeFormatValue("USD");
    } else if (val === "unit") {
      onChangeFormatValue("kg");
    } else {
      onChangeFormatValue("");
    }
  };

  const handleUnitChange = (v: string | null) => {
    const val = v || "kg";
    onChangeSelectedUnit(val);
    if (val !== "custom") {
      onChangeFormatValue(val);
    } else {
      onChangeFormatValue("");
    }
  };

  const handleLabelKeyMultiChange = (v: string[]) => {
    onChangeLabelKey(v ? v.join(",") : "");
  };

  const handleLabelKeySingleChange = (v: string | null) => {
    onChangeLabelKey(v || "");
  };

  return (
    <Box mt="xl">
      <Group gap="xs" mb="xs">
        <IconSettings size={16} color="gray" />
        <Text size="sm" fw={600} c="dimmed">
          4. COLUMN MAPPING
        </Text>
      </Group>
      <Stack gap="sm">
        {widgetType === "table" ? (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Automatic Mapping Active"
            color="violet"
            variant="light"
            radius="md"
            styles={{
              root: { background: "rgba(147, 51, 234, 0.05)", border: "1px solid rgba(147, 51, 234, 0.2)" },
              title: { color: "#c084fc", fontWeight: 700 },
            }}
          >
            Data Tables display all query result columns automatically. No manual X/Y axis mapping is required.
          </Alert>
        ) : widgetType === "kpi" || widgetType === "counter" ? (
          <Stack gap="sm">
            <Select
              label="Metric Column"
              placeholder="Select column to aggregate..."
              data={discoveredColumns}
              value={valueKeys[0] || ""}
              onChange={(v) => onChangeValueKeys(v ? [v] : [])}
              disabled={discoveredColumns.length === 0}
              styles={{
                label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                option: { color: "white" },
              }}
            />
            <Group grow>
              <Select
                label="Format Type"
                data={[
                  { value: "raw", label: "Raw Number" },
                  { value: "currency", label: "Currency" },
                  { value: "unit", label: "Measurement Unit" },
                ]}
                value={formatType}
                onChange={handleFormatTypeChange}
                styles={{
                  label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                  input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                  dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                  option: { color: "white" },
                }}
              />
              {formatType === "currency" && (
                <Select
                  label="Currency"
                  data={[
                    { value: "USD", label: "USD ($)" },
                    { value: "PHP", label: "PHP (₱)" },
                    { value: "EUR", label: "EUR (€)" },
                    { value: "CNY", label: "CNY (¥)" },
                    { value: "JPY", label: "JPY (¥)" },
                  ]}
                  value={formatValue}
                  onChange={(v) => onChangeFormatValue(v || "USD")}
                  styles={{
                    label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                    input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                    dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                    option: { color: "white" },
                  }}
                />
              )}
              {formatType === "unit" && (
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Select
                    label="Unit"
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
                    onChange={handleUnitChange}
                    styles={{
                      label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                      input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                      dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                      option: { color: "white" },
                    }}
                  />
                  {selectedUnit === "custom" && (
                    <TextInput
                      label="Custom Suffix"
                      placeholder="e.g. pixels, points"
                      value={formatValue}
                      onChange={(e) => onChangeFormatValue(e.currentTarget.value)}
                      styles={{
                        label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                        input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                      }}
                    />
                  )}
                </Stack>
              )}
            </Group>
            <Select
              label="Number Style"
              data={[
                { value: "compact", label: "Abbreviated (e.g. 11k)" },
                { value: "decimal", label: "Decimal (e.g. 11,000.00)" },
                { value: "integer", label: "Integer (e.g. 11,000)" },
              ]}
              value={numberFormat}
              onChange={(v) => onChangeNumberFormat(v || "compact")}
              styles={{
                label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                option: { color: "white" },
              }}
            />
          </Stack>
        ) : (
          <Group grow>
            {widgetType === "bar" ? (
              <MultiSelect
                label="Label Columns (X-Axis)"
                placeholder="Select label columns..."
                data={discoveredColumns}
                value={labelKey ? labelKey.split(",").map((s) => s.trim()) : []}
                onChange={handleLabelKeyMultiChange}
                disabled={discoveredColumns.length === 0}
                styles={{
                  label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                  input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                  dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                  option: { color: "white" },
                }}
              />
            ) : (
              <Select
                label="Label Column (X-Axis)"
                placeholder="Select label column..."
                data={discoveredColumns}
                value={labelKey.includes(",") ? labelKey.split(",")[0] : labelKey}
                onChange={handleLabelKeySingleChange}
                disabled={discoveredColumns.length === 0}
                styles={{
                  label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                  input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                  dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                  option: { color: "white" },
                }}
              />
            )}
            <MultiSelect
              label="Value Columns (Y-Axis)"
              placeholder="Select metric columns..."
              data={discoveredColumns}
              value={valueKeys}
              onChange={onChangeValueKeys}
              disabled={discoveredColumns.length === 0}
              styles={{
                label: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 },
                input: { background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
                dropdown: { background: "#0c0a1a", border: "1px solid rgba(147, 51, 234, 0.2)" },
                option: { color: "white" },
              }}
            />
          </Group>
        )}
      </Stack>
    </Box>
  );
}
