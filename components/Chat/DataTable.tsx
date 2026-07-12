"use client";

import React, { memo, useCallback, useState } from "react";
import { Box, Group, Text, Button, ScrollArea, Modal, TextInput, Stack, Menu, ActionIcon } from "@mantine/core";
import { IconTableExport, IconDownload, IconNotebook, IconCheck, IconDotsVertical, IconEye } from "@tabler/icons-react";
import { TableCellImage, isImageUrl } from "./TableCellImage";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { notifications } from "@mantine/notifications";

export const DataTable = memo(function DataTable({ data, sql, organizationId, configId, question, chatHistory, onViewFullData }: {
  data: any[];
  sql?: string;
  organizationId?: string;
  configId?: string | null;
  question?: string;
  chatHistory?: any[];
  onViewFullData?: (details: { data: any[], title: string, sql?: string }) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveModalOpened, setSaveModalOpened] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [fullDataModalOpened, setFullDataModalOpened] = useState(false);

  const handleViewFullData = () => {
    if (onViewFullData) {
      onViewFullData({
        data,
        title: question || "Query Result",
        sql
      });
    } else {
      setFullDataModalOpened(true);
    }
  };

  const saveResultMutation = useMutation(api.databook.saveResult);
  const currentUser = useQuery(api.users.getCurrentUser);

  const openSaveModal = () => {
    setSaveName(question || `Query Result - ${new Date().toLocaleDateString()}`);
    setSaveModalOpened(true);
  };

  const handleSaveToDatabook = async () => {
    if (!organizationId || !currentUser?._id) return;
    setIsSaving(true);
    try {
      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
      await saveResultMutation({
        organizationId: organizationId as any,
        configId: configId ? (configId as any) : undefined,
        name: saveName.trim() || `Query Result - ${new Date().toLocaleDateString()}`,
        question: question || "",
        sql: sql || "",
        resultColumns: columns,
        resultRows: JSON.stringify(data),
        chatHistory: chatHistory ? JSON.stringify(chatHistory) : undefined,
        createdBy: currentUser._id,
      });
      setIsSaved(true);
      setSaveModalOpened(false);
      notifications.show({
        title: "Saved to Databook",
        message: `Query result has been successfully saved as "${saveName}".`,
        color: "violet",
        icon: <IconCheck size={18} />,
        autoClose: 3000,
      });
    } catch (err: any) {
      console.error("[DataTable] Save to databook failed:", err);
      notifications.show({
        title: "Save Failed",
        message: err.message || "Failed to save query result to Databook.",
        color: "red",
        autoClose: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };
  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
  const PREVIEW_LIMIT = 20;
  const isDisplayCapped = data.length > PREVIEW_LIMIT;
  const hasMoreInDb = data.length >= 20;
  const displayData = isDisplayCapped ? data.slice(0, PREVIEW_LIMIT) : data;

  const exportPreviewCsv = useCallback(() => {
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.join(",");
    const rows = data.map(row => columns.map(c => escape(row[c])).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data, columns]);

  // Full export via API — fetch with streaming, no full blob buffering
  const exportFullCsv = useCallback(async () => {
    if (!sql || !organizationId) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, organizationId, configId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Export failed");

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.mode === "async") {
          // Poll for completion
          const downloadUrl = await new Promise<string>((resolve, reject) => {
            const interval = setInterval(async () => {
              try {
                const checkRes = await fetch(`/api/export/csv?jobId=${data.jobId}`);
                if (!checkRes.ok) throw new Error("Status check failed");
                const statusData = await checkRes.json();
                
                if (statusData.status === "completed") {
                  clearInterval(interval);
                  resolve(statusData.downloadUrl);
                } else if (statusData.status === "failed") {
                  clearInterval(interval);
                  reject(new Error(statusData.error || "Export job failed"));
                }
              } catch (err) {
                clearInterval(interval);
                reject(err);
              }
            }, 1500);
          });

          // Download using link
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `export_${Date.now()}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          throw new Error("Unexpected response format");
        }
      } else {
        // Sync mode: Direct stream download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [sql, organizationId, configId]);

  return (
    <Box style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--orcha-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
      {/* Toolbar */}
      <Box style={{ background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)", padding: "10px 16px" }}>
        <Group justify="space-between">
          <Group gap={10}>
            <Group gap={5}>
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--orcha-border)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--orcha-border)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(147,51,234,0.6)", boxShadow: "0 0 8px rgba(147,51,234,0.8)" }} />
            </Group>
            <Box style={{ width: 1, height: 14, background: "var(--orcha-border)" }} />
            <Text size="11px" fw={600} c="var(--orcha-purple)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>Result Set</Text>
            <Box style={{ padding: "2px 8px", borderRadius: 20, background: "var(--orcha-sidebar-hover-bg)", border: "1px solid var(--orcha-border)" }}>
              <Text size="10px" fw={700} c="var(--orcha-purple)">{data.length.toLocaleString()} rows · {columns.length} cols</Text>
            </Box>
          </Group>
          <Group gap={8}>
            <Menu shadow="md" width={180} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" color="violet" radius="md" size="md">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown
                style={{
                  background: "var(--orcha-panel)",
                  border: "1px solid var(--orcha-border)",
                  borderRadius: "10px",
                }}
              >
                <Menu.Label c="dimmed" style={{ fontSize: "10px", textTransform: "uppercase" }}>Actions</Menu.Label>
                
                <Menu.Item
                  leftSection={<IconEye size={14} />}
                  onClick={handleViewFullData}
                  style={{ fontSize: "12px", color: "var(--orcha-text-body)" }}
                >
                  View full data
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconTableExport size={14} />}
                  onClick={exportPreviewCsv}
                  style={{ fontSize: "12px", color: "var(--orcha-text-body)" }}
                >
                  Export preview
                </Menu.Item>

                {sql && (
                  <Menu.Item
                    leftSection={<IconDownload size={14} />}
                    onClick={exportFullCsv}
                    disabled={isExporting}
                    style={{ fontSize: "12px", color: "var(--orcha-text-body)" }}
                  >
                    {isExporting ? "Exporting..." : "Full dataset"}
                  </Menu.Item>
                )}

                {sql && organizationId && currentUser && (
                  <Menu.Item
                    leftSection={isSaved ? <IconCheck size={14} color="#22c55e" /> : <IconNotebook size={14} />}
                    onClick={isSaved ? undefined : openSaveModal}
                    disabled={isSaved}
                    style={{ 
                      fontSize: "12px", 
                      color: isSaved ? "var(--mantine-color-green-6)" : "var(--orcha-text-body)" 
                    }}
                  >
                    {isSaved ? "Saved to Databook" : "Save to Databook"}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Box>

      {/* Table */}
      <ScrollArea>
        <Box style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--orcha-surface)" }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "9px 12px", textAlign: "right", fontSize: 10, color: "var(--orcha-text-muted)", fontWeight: 500, borderBottom: "1px solid var(--orcha-border)", background: "var(--orcha-sidebar-hover-bg)", userSelect: "none" }}>#</th>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--orcha-purple)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid var(--orcha-border)", borderLeft: "1px solid var(--orcha-table-border)", background: "var(--orcha-sidebar-hover-bg)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={1} style={{ padding: "24px", textAlign: "center", color: "var(--orcha-text-muted)", fontSize: 12 }}>
                    No records found matching your filters.
                  </td>
                </tr>
              ) : (
                displayData.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "var(--orcha-table-border)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--orcha-sidebar-hover-bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "var(--orcha-table-border)"; }}
                  >
                    <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, color: "var(--orcha-text-muted)", borderBottom: "1px solid var(--orcha-table-border)", userSelect: "none" }}>{ri + 1}</td>
                    {columns.map((col, ci) => {
                      const val = row[col];
                      const isNull = val == null;
                      
                      // Check if value is numeric (either a number or a numeric string)
                      const isNumericString = typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim());
                      const isNum = !isNull && (typeof val === "number" || isNumericString);
                      
                      // Exclude IDs, years, zip codes, and phones from comma formatting
                      const lowerCol = col.toLowerCase();
                      const isIdentifier = lowerCol === "id" || lowerCol.endsWith("_id") || lowerCol.endsWith("id") || lowerCol === "year" || lowerCol === "zip" || lowerCol === "zipcode" || lowerCol.includes("phone");
                      
                      let displayVal = String(val);
                      if (!isNull && isNum && !isIdentifier) {
                        const numVal = Number(val);
                        if (!isNaN(numVal)) {
                          displayVal = numVal.toLocaleString();
                        }
                      } else if (isNull) {
                        displayVal = "null";
                      }

                      // For coloring negative numbers
                      const numericValue = !isNull && isNum ? Number(val) : NaN;
                      const isNegative = !isNaN(numericValue) && numericValue < 0;

                      const isImg = isImageUrl(val);
                      return (
                        <td key={ci} style={{ padding: "7px 16px", fontSize: 12, color: isNull ? "var(--orcha-null-color)" : isNum && isNegative ? "#ef4444" : isNum ? "var(--orcha-number-color)" : "var(--orcha-text-body)", fontStyle: isNull ? "italic" : "normal", fontFamily: isNum ? "var(--font-geist-mono,monospace)" : "inherit", whiteSpace: "nowrap", borderBottom: "1px solid var(--orcha-table-border)", borderLeft: "1px solid var(--orcha-table-border)", textAlign: isNum ? "right" : "left" }}>
                          {isImg ? <TableCellImage url={val} /> : displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Box>
      </ScrollArea>

      {/* Footer */}
      {(isDisplayCapped || hasMoreInDb) && (
        <Box style={{ padding: "8px 16px", borderTop: "1px solid var(--orcha-border)", background: "var(--orcha-panel)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Group gap={6}>
            <Box style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(147,51,234,0.5)" }} />
            <Text size="11px" c="dimmed">
              {hasMoreInDb 
                ? `Showing first 20 of ${data.length} rows (limit reached)` 
                : `Showing first 20 of ${data.length} rows`}
            </Text>
          </Group>
          <Group gap={8}>
            <Button size="compact-xs" variant="subtle" color="violet" radius="md" leftSection={<IconEye size={11} />} onClick={handleViewFullData} styles={{ root: { fontSize: 11 } }}>
              View full dataset
            </Button>
            {sql && (
              <Button size="compact-xs" variant="light" color="violet" radius="md" loading={isExporting} leftSection={<IconDownload size={11} />} onClick={exportFullCsv} styles={{ root: { fontSize: 11 } }}>
                Download CSV
              </Button>
            )}
          </Group>
        </Box>
      )}

      {/* Save to Databook Modal */}
      <Modal
        opened={saveModalOpened}
        onClose={() => setSaveModalOpened(false)}
        title={<Text fw={700} c="var(--orcha-text-title)">Save Query to Databook</Text>}
        centered
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
          header: { background: "var(--orcha-panel)" },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            description="Give this saved query result a friendly name to identify it in your Databook"
            placeholder="E.g. Monthly Revenue Summary"
            value={saveName}
            onChange={(e) => setSaveName(e.currentTarget.value)}
            data-autofocus
            styles={{
              input: {
                background: "var(--orcha-surface)",
                border: "1px solid var(--orcha-border)",
                color: "var(--orcha-text-title)"
              },
              label: { color: "var(--orcha-text-title)" },
              description: { color: "var(--orcha-text-muted)" }
            }}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setSaveModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="violet"
              loading={isSaving}
              onClick={handleSaveToDatabook}
            >
              Save Result
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Full Data Modal */}
      <Modal
        opened={fullDataModalOpened}
        onClose={() => setFullDataModalOpened(false)}
        title={
          <Group gap={8}>
            <Text fw={700} c="var(--orcha-text-title)">Full Dataset View</Text>
            <Box style={{ padding: "2px 8px", borderRadius: 20, background: "var(--orcha-sidebar-hover-bg)", border: "1px solid var(--orcha-border)" }}>
              <Text size="10px" fw={700} c="var(--orcha-purple)">{data.length.toLocaleString()} rows · {columns.length} cols</Text>
            </Box>
          </Group>
        }
        size="95%"
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
          header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)" },
        }}
      >
        <ScrollArea h="75vh" type="auto">
          <Box style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--orcha-surface)" }}>
              <thead>
                <tr>
                  <th style={{ width: 40, padding: "9px 12px", textAlign: "right", fontSize: 10, color: "var(--orcha-text-muted)", fontWeight: 500, borderBottom: "1px solid var(--orcha-border)", background: "var(--orcha-sidebar-hover-bg)", userSelect: "none" }}>#</th>
                  {columns.map((col) => (
                    <th key={col} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--orcha-purple)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid var(--orcha-border)", borderLeft: "1px solid var(--orcha-table-border)", background: "var(--orcha-sidebar-hover-bg)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "var(--orcha-table-border)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--orcha-sidebar-hover-bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "var(--orcha-table-border)"; }}
                  >
                    <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, color: "var(--orcha-text-muted)", borderBottom: "1px solid var(--orcha-table-border)", userSelect: "none" }}>{ri + 1}</td>
                    {columns.map((col, ci) => {
                      const val = row[col];
                      const isNull = val == null;
                      
                      const isNumericString = typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim());
                      const isNum = !isNull && (typeof val === "number" || isNumericString);
                      
                      const lowerCol = col.toLowerCase();
                      const isIdentifier = lowerCol === "id" || lowerCol.endsWith("_id") || lowerCol.endsWith("id") || lowerCol === "year" || lowerCol === "zip" || lowerCol === "zipcode" || lowerCol.includes("phone");
                      
                      let displayVal = String(val);
                      if (!isNull && isNum && !isIdentifier) {
                        const numVal = Number(val);
                        if (!isNaN(numVal)) {
                          displayVal = numVal.toLocaleString();
                        }
                      } else if (isNull) {
                        displayVal = "null";
                      }

                      const numericValue = !isNull && isNum ? Number(val) : NaN;
                      const isNegative = !isNaN(numericValue) && numericValue < 0;
                      const isImg = isImageUrl(val);

                      return (
                        <td key={ci} style={{ padding: "7px 16px", fontSize: 12, color: isNull ? "var(--orcha-null-color)" : isNum && isNegative ? "#ef4444" : isNum ? "var(--orcha-number-color)" : "var(--orcha-text-body)", fontStyle: isNull ? "italic" : "normal", fontFamily: isNum ? "var(--font-geist-mono,monospace)" : "inherit", whiteSpace: "nowrap", borderBottom: "1px solid var(--orcha-table-border)", borderLeft: "1px solid var(--orcha-table-border)", textAlign: isNum ? "right" : "left" }}>
                          {isImg ? <TableCellImage url={val} /> : displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </ScrollArea>
      </Modal>
    </Box>
  );
});
