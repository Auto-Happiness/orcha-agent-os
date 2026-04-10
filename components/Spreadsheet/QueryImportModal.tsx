"use client";

import { useState, useCallback } from "react";
import { Modal, Stack, Text, Select, Box, Button, Group, Loader, Badge, ScrollArea, Table } from "@mantine/core";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { IconPlayerPlay, IconTableImport, IconDatabase } from "@tabler/icons-react";
import { Cell } from "./types";

interface Props {
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  onImport: (rows: Cell[][]) => void;
}

export function QueryImportModal({ opened, onClose, organizationId, onImport }: Props) {
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<{ columns: string[]; rows: any[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configs = useQuery(
    api.databaseConfigs.listByOrganization,
    organizationId ? { organizationId: organizationId as Id<"organizations"> } : "skip"
  );

  const savedQueries = useQuery(
    api.savedQueries.listByConfig,
    selectedConfigId ? { configId: selectedConfigId as Id<"databaseConfigs"> } : "skip"
  );

  const selectedConfig = configs?.find(c => c._id === selectedConfigId);
  const selectedQuery = savedQueries?.find(q => q._id === selectedQueryId);

  const handleRun = useCallback(async () => {
    if (!selectedConfig || !selectedQuery) return;
    setRunning(true);
    setError(null);
    setPreview(null);
    try {
      const dbConfig = JSON.parse(selectedConfig.encryptedUri);
      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedConfig.type,
          config: dbConfig,
          sql: selectedQuery.sql,
        }),
      });
      const data = await res.json();
      console.log("[QueryImport] response:", data);
      if (!data.success) throw new Error(data.message ?? "Query failed");
      if (!data.rows || data.rows.length === 0) {
        setPreview({ columns: data.columns ?? [], rows: [] });
        return;
      }
      // rows can be objects (MySQL) or arrays — normalise to 2D array
      const columns: string[] = data.columns ?? (data.rows[0] ? Object.keys(data.rows[0]) : []);
      const rows: any[][] = data.rows.map((row: any) =>
        Array.isArray(row) ? row : columns.map(col => row[col] ?? null)
      );
      setPreview({ columns, rows });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [selectedConfig, selectedQuery]);

  const handleImport = useCallback(() => {
    if (!preview) return;
    // Build Cell[][] — header row + data rows
    const headerRow: Cell[] = preview.columns.map(col => ({ v: col, bl: 1 }));
    const dataRows: Cell[][] = preview.rows.map(row =>
      preview.columns.map((_, ci) => {
        const val = row[ci];
        if (val == null) return null as any;
        const isNum = typeof val === "number";
        return { v: isNum ? val : String(val) } as Cell;
      })
    );
    onImport([headerRow, ...dataRows]);
    onClose();
  }, [preview, onImport, onClose]);

  const handleClose = () => {
    setSelectedConfigId(null);
    setSelectedQueryId(null);
    setPreview(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap={8}>
          <IconTableImport size={18} color="#a855f7" />
          <Text fw={600} c="white">Import Query Results</Text>
        </Group>
      }
      size="xl"
      radius="md"
      styles={{
        content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" },
        header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" },
        title: { color: "white" },
        close: { color: "rgba(255,255,255,0.5)" },
      }}
    >
      <Stack gap="md">
        {/* Step 1: Select config */}
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={6} style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
            1. Select Database Configuration
          </Text>
          <Select
            placeholder={configs === undefined ? "Loading..." : "Choose a configuration"}
            data={(configs ?? []).map(c => ({ value: c._id, label: c.name }))}
            value={selectedConfigId}
            onChange={v => { setSelectedConfigId(v); setSelectedQueryId(null); setPreview(null); }}
            leftSection={<IconDatabase size={14} color="#a855f7" />}
            styles={{
              input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.2)", color: "white", borderRadius: 6 },
              dropdown: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 8 },
              option: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
            }}
          />
        </Box>

        {/* Step 2: Select saved query */}
        {selectedConfigId && (
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={6} style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
              2. Select Saved Query
            </Text>
            {savedQueries === undefined ? (
              <Group gap={8}><Loader size="xs" color="violet" /><Text size="xs" c="dimmed">Loading queries...</Text></Group>
            ) : savedQueries.length === 0 ? (
              <Text size="xs" c="dimmed">No saved queries for this configuration. Save queries from the Configure page first.</Text>
            ) : (
              <Stack gap={6}>
                {savedQueries.map(q => (
                  <Box
                    key={q._id}
                    onClick={() => { setSelectedQueryId(q._id); setPreview(null); setError(null); }}
                    style={{
                      padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                      background: selectedQueryId === q._id ? "rgba(147,51,234,0.15)" : "rgba(255,255,255,0.03)",
                      border: selectedQueryId === q._id ? "1px solid rgba(147,51,234,0.35)" : "1px solid rgba(255,255,255,0.06)",
                      transition: "all 0.15s",
                    }}
                  >
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={600} c="white">{q.name}</Text>
                        {q.description && <Text size="xs" c="dimmed" mt={2}>{q.description}</Text>}
                      </Box>
                      <Badge size="xs" variant="light" color="violet">SQL</Badge>
                    </Group>
                    {selectedQueryId === q._id && (
                      <Box mt={8} p={8} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.6)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {q.sql}
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        )}

        {/* Run button */}
        {selectedQueryId && (
          <Button
            leftSection={running ? <Loader size={14} color="white" /> : <IconPlayerPlay size={14} />}
            color="violet"
            onClick={handleRun}
            disabled={running}
            radius="md"
          >
            {running ? "Running..." : "Execute Query"}
          </Button>
        )}

        {/* Error */}
        {error && (
          <Box p="sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8 }}>
            <Text size="xs" c="red.4">{error}</Text>
          </Box>
        )}

        {/* Preview */}
        {preview && (
          <Box>
            <Group justify="space-between" mb={8}>
              <Group gap={6}>
                <Text size="xs" fw={600} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Preview
                </Text>
                <Badge size="xs" variant="light" color="green">{preview.rows.length} rows</Badge>
              </Group>
              <Button size="compact-sm" color="violet" radius="md" leftSection={<IconTableImport size={13} />} onClick={handleImport}>
                Import to Spreadsheet
              </Button>
            </Group>
            <ScrollArea style={{ maxHeight: 240 }}>
              <Box style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(147,51,234,0.08)" }}>
                      {preview.columns.map(col => (
                        <th key={col} style={{ padding: "6px 12px", textAlign: "left", color: "rgba(192,132,252,0.8)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(147,51,234,0.15)", whiteSpace: "nowrap" }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 10).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        {preview.columns.map((_, ci) => (
                          <td key={ci} style={{ padding: "5px 12px", color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
                            {row[ci] == null ? <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>null</span> : String(row[ci])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </ScrollArea>
            {preview.rows.length > 10 && (
              <Text size="11px" c="dimmed" ta="center" mt={6}>Showing 10 of {preview.rows.length} rows — all rows will be imported</Text>
            )}
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
