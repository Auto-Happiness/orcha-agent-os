"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Drawer, Stack, Group, Text, Box, Button, ScrollArea, Badge } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

import { TextBoxConfigSection } from "./WidgetIntelligencePanel/TextBoxConfigSection";
import { QuerySelectorSection } from "./WidgetIntelligencePanel/QuerySelectorSection";
import { SchemaDiscoverySection } from "./WidgetIntelligencePanel/SchemaDiscoverySection";
import { ColumnMappingSection } from "./WidgetIntelligencePanel/ColumnMappingSection";
import { LookAndFeelSection } from "./WidgetIntelligencePanel/LookAndFeelSection";
import { LivePreviewSection } from "./WidgetIntelligencePanel/LivePreviewSection";

interface WidgetIntelligencePanelProps {
  opened: boolean;
  onClose: () => void;
  widget: any; // The current widget model or template
  mode?: "create" | "edit";
  onSave?: (widgetData: any) => void;
  saas: string;
}

export function WidgetIntelligencePanel({
  opened,
  onClose,
  widget,
  mode = "edit",
  onSave,
  saas,
}: WidgetIntelligencePanelProps) {
  // Dynamic States for Mapping
  const user = useQuery(api.users.getCurrentUser);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(widget?.configId || null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(widget?.queryId || null);
  const [widgetType, setWidgetType] = useState<string>(widget?.type || "bar");
  const [discoveredColumns, setDiscoveredColumns] = useState<string[]>([]);
  const [labelKey, setLabelKey] = useState(widget?.mapping?.labelKey || "");
  const [valueKeys, setValueKeys] = useState<string[]>(widget?.mapping?.valueKeys || []);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  // Styling States
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(widget?.mapping?.seriesColors || {});
  const [widgetTitle, setWidgetTitle] = useState(widget?.title || "");
  const [textContent, setTextContent] = useState(widget?.description || "");
  const [isSaving, setIsSaving] = useState(false);

  // Formatting States for KPI / Counter
  const [formatType, setFormatType] = useState<string>(widget?.mapping?.formatType || "raw");
  const [formatValue, setFormatValue] = useState<string>(widget?.mapping?.formatValue || "");
  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    const val = widget?.mapping?.formatValue || "";
    const commonUnits = ["kg", "lbs", "cm", "m", "%", "pcs"];
    if (widget?.mapping?.formatType === "unit") {
      return commonUnits.includes(val) ? val : val ? "custom" : "kg";
    }
    return "kg";
  });
  const [numberFormat, setNumberFormat] = useState<string>(widget?.mapping?.numberFormat || "compact");

  const colorKeys = useMemo(() => {
    if ((widgetType === "pie" || widgetType === "bar") && labelKey && previewRows.length > 0) {
      if (widgetType === "pie" || valueKeys.length <= 1) {
        return Array.from(
          new Set(
            previewRows.map((row: any) => {
              if (labelKey.includes(",")) {
                const keys = labelKey.split(",").map((k: string) => k.trim());
                return keys
                  .map((k: string) => String(row[k] !== undefined ? row[k] : ""))
                  .filter(Boolean)
                  .join(" - ") || "Unknown";
              }
              return String(row[labelKey] || "");
            })
          )
        );
      }
    }
    return valueKeys;
  }, [widgetType, labelKey, valueKeys, previewRows]);

  // Reset state when panel opens/closes
  useEffect(() => {
    if (opened) {
      setSelectedConfigId(widget?.configId || null);
      setSelectedQueryId(widget?.queryId || null);
      setWidgetType(widget?.type || "bar");
      setLabelKey(widget?.mapping?.labelKey || "");
      setValueKeys(widget?.mapping?.valueKeys || []);
      setSeriesColors(widget?.mapping?.seriesColors || {});
      setWidgetTitle(widget?.title || "");
      setTextContent(widget?.description || "");
      setFormatType(widget?.mapping?.formatType || "raw");
      setFormatValue(widget?.mapping?.formatValue || "");
      const val = widget?.mapping?.formatValue || "";
      const commonUnits = ["kg", "lbs", "cm", "m", "%", "pcs"];
      if (widget?.mapping?.formatType === "unit") {
        setSelectedUnit(commonUnits.includes(val) ? val : val ? "custom" : "kg");
      } else {
        setSelectedUnit("kg");
      }
      setNumberFormat(widget?.mapping?.numberFormat || "compact");
      setIsSaving(false);
    } else {
      // Clear specific transient states on close
      setDiscoveredColumns([]);
      setIsExecuting(false);
      setExecutionError(null);
      setPreviewRows([]);
    }
  }, [opened, widget]);

  // Sync series colors when colorKeys change using functional state update to prevent wiping custom colors
  useEffect(() => {
    setSeriesColors((prev) => {
      const newSeriesColors = { ...prev };
      let changed = false;

      colorKeys.forEach((key, index) => {
        if (!newSeriesColors[key]) {
          // Auto-assign from a default attractive palette
          const defaultPalette = ["#9333ea", "#00D1FF", "#00FF94", "#FF00E5", "#FFB800", "#FF6B6B"];
          newSeriesColors[key] = defaultPalette[index % defaultPalette.length];
          changed = true;
        }
      });

      return changed ? newSeriesColors : prev;
    });
  }, [colorKeys]);

  // Mutants & Queries
  const organization = useQuery(api.organizations.getSafeBySlug, { slug: saas });
  const configs = useQuery(api.databaseConfigs.listByOrganization, organization ? { organizationId: organization._id } : "skip");
  const savedQueries = useQuery(api.savedQueries.listByConfig, selectedConfigId ? { configId: selectedConfigId as any } : "skip");

  const nonFederatedQueries = useMemo(() => {
    return savedQueries?.filter((q) => !q.isFederated) || [];
  }, [savedQueries]);

  const handleExecute = async () => {
    const config = configs?.find((c) => c._id === selectedConfigId);
    const query = nonFederatedQueries.find((q) => q._id === selectedQueryId);
    if (!config || !query) return;

    setIsExecuting(true);
    setExecutionError(null);
    try {
      const dbConfig = JSON.parse(config.encryptedUri);

      let innerSql = query.sql.trim().replace(/;?\s*$/, "");
      const isMssql = config.type === "mssql";
      let limitedSql = "";

      if (isMssql) {
        if (/ORDER\s+BY/i.test(innerSql) && !/TOP\s+\d+/i.test(innerSql)) {
          innerSql = innerSql.replace(/(\bSELECT\b(\s+DISTINCT)?)/i, "$1 TOP 100 PERCENT ");
        }
        limitedSql = `SELECT TOP 10 * FROM (${innerSql}) AS _orcha_preview`;
      } else {
        limitedSql = `SELECT * FROM (${innerSql}) AS _orcha_preview LIMIT 10`;
      }

      console.log(`[BI Discovery] Executing with Best-Practice Safeguard: ${limitedSql}`);

      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: config.type,
          config: dbConfig,
          sql: limitedSql,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Query failed");

      const cols = data.columns || (data.rows[0] ? Object.keys(data.rows[0]) : []);
      setDiscoveredColumns(cols);
      setPreviewRows(data.rows || []);
    } catch (err: any) {
      setExecutionError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const getSmartValidationLogs = () => {
    const query = nonFederatedQueries.find((q) => q._id === selectedQueryId);
    if (!query) return [];

    const logs: { type: "success" | "warning" | "info"; message: string; id: string }[] = [];
    const sql = query.sql.toUpperCase();

    // Aggregation Checks
    const hasGroupBy = sql.includes("GROUP BY");
    const hasAggregation = /COUNT\s*\(|SUM\s*\(|AVG\s*\(|MIN\s*\(|MAX\s*\(/.test(sql);

    if (hasGroupBy) logs.push({ id: "group-by", type: "success", message: "Group By detected - Perfect for categorical charts." });
    if (hasAggregation) logs.push({ id: "agg", type: "success", message: "Aggregations found - Data is summarized." });
    if (!hasGroupBy && !hasAggregation) {
      logs.push({ id: "raw", type: "info", message: "Raw data detected. Charts usually require GROUP BY for better visuals." });
    }

    // Filter Checks
    if (sql.includes("WHERE")) {
      logs.push({ id: "where", type: "success", message: "Query limited by WHERE filters." });
    } else {
      logs.push({ id: "no-where", type: "info", message: "No WHERE clause - extracting full dataset scope." });
    }

    // Cardinality / Execution Checks
    const rowCount = previewRows.length;
    if (rowCount > 0) {
      if (rowCount > 20) {
        logs.push({ id: "high-card", type: "warning", message: `High Cardinality: ${rowCount} rows found. Visuals might be cluttered.` });
      } else {
        logs.push({ id: "low-card", type: "success", message: `Optimized Density: ${rowCount} rows is ideal for charting.` });
      }
    }

    // Chart-Specific Logic
    if (widget?.type === "line") {
      const hasTime = /(DATE|TIME|CREATED|TS|YEAR|MONTH|DAY)/.test(sql);
      if (!hasTime) {
        logs.push({ id: "time-warn", type: "warning", message: "Line charts usually require a time-based X-Axis column." });
      }
    }

    return logs;
  };

  const validationLogs = getSmartValidationLogs();
  const isTextWidget = widget?.type === "text";

  if (isTextWidget) {
    return (
      <TextBoxConfigSection
        opened={opened}
        onClose={onClose}
        widget={widget}
        mode={mode}
        onSave={onSave}
      />
    );
  }

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave({
          ...widget,
          title: widgetTitle || widget?.title,
          description: textContent,
          queryId: selectedQueryId,
          type: widgetType as any,
          mapping: { labelKey, valueKeys, seriesColors, formatType, formatValue, numberFormat },
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
      size="80%"
      title={
        <Group gap="xs">
          <IconSparkles size={22} color="#a855f7" />
          <Text fw={800} size="xl">
            Insight Intelligence Engine
          </Text>
          <Badge variant="outline" color="violet">
            {widget?.type?.toUpperCase()} WIDGET
          </Badge>
        </Group>
      }
      padding="xl"
      styles={{
        content: {
          background: "#0c0a1a",
          borderLeft: "1px solid rgba(147, 51, 234, 0.2)",
          color: "white",
        },
        header: {
          background: "#0c0a1a",
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: 20,
        },
      }}
    >
      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap="xl" p="xs">
            <QuerySelectorSection
              widgetTitle={widgetTitle}
              onChangeWidgetTitle={setWidgetTitle}
              selectedConfigId={selectedConfigId}
              onChangeSelectedConfigId={setSelectedConfigId}
              selectedQueryId={selectedQueryId}
              onChangeSelectedQueryId={setSelectedQueryId}
              configs={configs}
              nonFederatedQueries={nonFederatedQueries}
            />

            <SchemaDiscoverySection
              selectedQueryId={selectedQueryId}
              validationLogs={validationLogs}
              onExecute={handleExecute}
              isExecuting={isExecuting}
              executionError={executionError}
              discoveredColumns={discoveredColumns}
              previewRows={previewRows}
            />

            <ColumnMappingSection
              widgetType={widgetType}
              discoveredColumns={discoveredColumns}
              labelKey={labelKey}
              onChangeLabelKey={setLabelKey}
              valueKeys={valueKeys}
              onChangeValueKeys={setValueKeys}
              formatType={formatType}
              onChangeFormatType={setFormatType}
              formatValue={formatValue}
              onChangeFormatValue={setFormatValue}
              selectedUnit={selectedUnit}
              onChangeSelectedUnit={setSelectedUnit}
              numberFormat={numberFormat}
              onChangeNumberFormat={setNumberFormat}
            />

            <LookAndFeelSection
              widgetType={widgetType}
              colorKeys={colorKeys}
              seriesColors={seriesColors}
              onChangeSeriesColors={setSeriesColors}
            />

            <LivePreviewSection
              widgetType={widgetType}
              previewRows={previewRows}
              labelKey={labelKey}
              valueKeys={valueKeys}
              seriesColors={seriesColors}
              formatType={formatType}
              formatValue={formatValue}
              numberFormat={numberFormat}
            />

            <Group justify="flex-end" mt="xl" mb="md">
              <Button variant="subtle" color="gray" onClick={onClose}>
                Cancel
              </Button>
              <Button color="violet" loading={isSaving} onClick={handleSave}>
                {mode === "create" ? "Add to Dashboard" : "Apply Settings"}
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
      </Box>
    </Drawer>
  );
}

function getAdviceForType(type?: string) {
  switch (type) {
    case "bar":
      return "Bar charts work best for comparing categories. Select one categorical column (String) and one numeric value.";
    case "line":
      return "Line charts are ideal for trends over time. Please select a Date/Time column for the X-Axis.";
    case "pie":
      return "Pie charts show proportions. Best with 2-5 distinct categories to keep the visual clean.";
    case "kpi":
      return "KPIs show single high-impact numbers. Map a singular 'Value' column.";
    default:
      return "Select a data source to begin mapping columns to your visual.";
  }
}
