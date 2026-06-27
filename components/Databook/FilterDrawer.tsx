"use client";

import React, { useState, useEffect } from "react";
import { Drawer, Stack, Grid, Text, Select, Group, TextInput, ActionIcon, Button } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";

export const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

interface FilterDrawerProps {
  opened: boolean;
  onClose: () => void;
  columns: { value: string; label: string }[];
  activeFilterRules: any[];
  onApply: (rules: any[]) => void;
  onClear: () => void;
  refreshing: boolean;
}

export function FilterDrawer({
  opened,
  onClose,
  columns,
  activeFilterRules,
  onApply,
  onClear,
  refreshing,
}: FilterDrawerProps) {
  const [tempFilterRules, setTempFilterRules] = useState<any[]>([]);

  useEffect(() => {
    if (opened) {
      if (activeFilterRules.length === 0) {
        setTempFilterRules([
          {
            id: Math.random().toString(36).substring(2, 9),
            column: columns[0]?.value || "",
            type: "between",
            dateFrom: "",
            dateTo: "",
            month: "1",
            year: new Date().getFullYear().toString(),
          }
        ]);
      } else {
        setTempFilterRules(activeFilterRules.map(r => ({ ...r })));
      }
    }
  }, [opened, activeFilterRules, columns]);

  const handleAddRule = () => {
    setTempFilterRules((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        column: columns[0]?.value || "",
        type: "between",
        dateFrom: "",
        dateTo: "",
        month: "1",
        year: new Date().getFullYear().toString(),
      },
    ]);
  };

  const handleUpdateRule = (index: number, updates: Partial<any>) => {
    setTempFilterRules((prev) =>
      prev.map((rule, idx) => (idx === index ? { ...rule, ...updates } : rule))
    );
  };

  const handleRemoveRule = (index: number) => {
    setTempFilterRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Configure Query Filters"
      position="right"
      size="850px"
      overlayProps={{
        color: "#05010d",
        opacity: 0.85,
        blur: 10,
      }}
      styles={{
        content: { background: "var(--orcha-panel)", borderLeft: "1px solid var(--orcha-border)", padding: "1.5rem" },
        header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)", paddingBottom: "1rem" },
        title: { color: "var(--orcha-text-title)", fontWeight: 600 }
      }}
    >
      <Stack gap="md">
        {columns.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No columns discovered for filtering. Make sure your query references valid tables.
          </Text>
        ) : (
          <>
            {tempFilterRules.length > 0 && (
              <Grid styles={{ inner: { gap: "var(--mantine-spacing-md)" } }} mb="xs" style={{ borderBottom: "1px solid var(--orcha-border)", paddingBottom: "8px" }}>
                <Grid.Col span={4}><Text size="xs" fw={600} c="dimmed">Column</Text></Grid.Col>
                <Grid.Col span={3}><Text size="xs" fw={600} c="dimmed">Filter Type</Text></Grid.Col>
                <Grid.Col span={4}><Text size="xs" fw={600} c="dimmed">Value / Range</Text></Grid.Col>
                <Grid.Col span={1}></Grid.Col>
              </Grid>
            )}

            <Stack gap="sm">
              {tempFilterRules.map((rule, idx) => (
                <Grid key={rule.id || idx} align="center" styles={{ inner: { gap: "var(--mantine-spacing-md)" } }}>
                  <Grid.Col span={4}>
                    <Select
                      placeholder="Select column"
                      data={columns}
                      value={rule.column}
                      onChange={(val) => handleUpdateRule(idx, { column: val || "" })}
                      styles={{
                        input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Select
                      placeholder="Select type"
                      data={[
                        { value: "between", label: "Date Range" },
                        { value: "month_year", label: "Month & Year" },
                        { value: "year", label: "Year Only" },
                        { value: "month", label: "Month Only" },
                      ]}
                      value={rule.type}
                      onChange={(val) => handleUpdateRule(idx, { type: val || "between" })}
                      styles={{
                        input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    {rule.type === "between" && (
                      <Group gap="xs" grow wrap="nowrap">
                        <TextInput
                          type="date"
                          placeholder="From"
                          value={rule.dateFrom || ""}
                          onChange={(e) => handleUpdateRule(idx, { dateFrom: e.target.value })}
                          styles={{
                            input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                          }}
                        />
                        <TextInput
                          type="date"
                          placeholder="To"
                          value={rule.dateTo || ""}
                          onChange={(e) => handleUpdateRule(idx, { dateTo: e.target.value })}
                          styles={{
                            input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                          }}
                        />
                      </Group>
                    )}
                    {rule.type === "month_year" && (
                      <Group gap="xs" grow wrap="nowrap">
                        <Select
                          placeholder="Month"
                          data={MONTH_OPTIONS}
                          value={rule.month}
                          onChange={(val) => handleUpdateRule(idx, { month: val || "1" })}
                          styles={{
                            input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                          }}
                        />
                        <TextInput
                          placeholder="Year"
                          value={rule.year || ""}
                          onChange={(e) => handleUpdateRule(idx, { year: e.target.value })}
                          styles={{
                            input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                          }}
                        />
                      </Group>
                    )}
                    {rule.type === "year" && (
                      <TextInput
                        placeholder="Year (YYYY)"
                        value={rule.year || ""}
                        onChange={(e) => handleUpdateRule(idx, { year: e.target.value })}
                        styles={{
                          input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                        }}
                      />
                    )}
                    {rule.type === "month" && (
                      <Select
                        placeholder="Month"
                        data={MONTH_OPTIONS}
                        value={rule.month}
                        onChange={(val) => handleUpdateRule(idx, { month: val || "1" })}
                        styles={{
                          input: { background: "var(--orcha-surface)", borderColor: "var(--orcha-border)", color: "var(--orcha-text-title)" }
                        }}
                      />
                    )}
                  </Grid.Col>
                  <Grid.Col span={1} style={{ display: "flex", justifyContent: "center" }}>
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="md"
                      radius="md"
                      onClick={() => handleRemoveRule(idx)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Grid.Col>
                </Grid>
              ))}
            </Stack>

            <Group justify="flex-start" mt="xs">
              <Button
                leftSection={<IconPlus size={14} />}
                variant="outline"
                color="violet"
                size="xs"
                onClick={handleAddRule}
              >
                Add Filter Rule
              </Button>
            </Group>

            <Group justify="flex-end" gap="sm" mt="lg" style={{ borderTop: "1px solid var(--orcha-border)", paddingTop: "1rem" }}>
              {activeFilterRules.length > 0 && (
                <Button variant="subtle" color="red" size="sm" onClick={onClear} loading={refreshing}>
                  Clear Filters
                </Button>
              )}
              <Button variant="subtle" color="gray" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                color="violet"
                size="sm"
                onClick={() => onApply(tempFilterRules)}
                loading={refreshing}
                disabled={tempFilterRules.length === 0}
              >
                Apply & Run Query
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
