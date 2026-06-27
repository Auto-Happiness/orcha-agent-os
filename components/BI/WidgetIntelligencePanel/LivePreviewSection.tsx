import React from "react";
import { Box, Group, Text, Paper } from "@mantine/core";
import { IconChartPie } from "@tabler/icons-react";
import { DynamicChart } from "../DynamicChart";

interface LivePreviewSectionProps {
  widgetType: string;
  previewRows: any[];
  labelKey: string;
  valueKeys: string[];
  seriesColors: Record<string, string>;
  formatType: string;
  formatValue: string;
  numberFormat: string;
}

export function LivePreviewSection({
  widgetType,
  previewRows,
  labelKey,
  valueKeys,
  seriesColors,
  formatType,
  formatValue,
  numberFormat,
}: LivePreviewSectionProps) {
  const hasData = previewRows && previewRows.length > 0;
  const isTable = widgetType === "table";
  const isKPIOrCounter = widgetType === "kpi" || widgetType === "counter";

  const renderContent = () => {
    if (isTable && hasData) {
      return (
        <DynamicChart
          data={previewRows}
          type={widgetType as any}
          labelKey={labelKey}
          valueKeys={valueKeys}
          height={240}
          seriesColors={seriesColors}
        />
      );
    }
    if (isKPIOrCounter && hasData && valueKeys.length > 0) {
      return (
        <DynamicChart
          data={previewRows}
          type={widgetType as any}
          labelKey={labelKey}
          valueKeys={valueKeys}
          height={240}
          seriesColors={seriesColors}
          formatType={formatType}
          formatValue={formatValue}
          numberFormat={numberFormat}
        />
      );
    }
    if (!isTable && !isKPIOrCounter && hasData && labelKey && valueKeys.length > 0) {
      return (
        <DynamicChart
          data={previewRows}
          type={widgetType as any}
          labelKey={labelKey}
          valueKeys={valueKeys}
          height={240}
          seriesColors={seriesColors}
        />
      );
    }

    // Fallbacks
    if (!hasData) {
      return <Text size="xs" c="dimmed">Run the query in Step 3 to fetch preview data</Text>;
    }
    if (isKPIOrCounter && valueKeys.length === 0) {
      return <Text size="xs" c="dimmed">Select a metric column to see a live preview</Text>;
    }
    return <Text size="xs" c="dimmed">Select label and value columns to generate preview</Text>;
  };

  return (
    <Box mt="md">
      <Group gap="xs" mb="xs">
        <IconChartPie size={16} color="gray" />
        <Text size="sm" fw={600} c="dimmed">
          6. LIVE PREVIEW
        </Text>
      </Group>
      <Paper
        p="md"
        radius="md"
        h={280}
        style={{
          position: "relative",
          background: "var(--orcha-surface)",
          border: "1px solid var(--orcha-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {renderContent()}
      </Paper>
    </Box>
  );
}
