"use client";

import React, { useState } from "react";
import {
  Table,
  Group,
  Stack,
  Text,
  Button,
  TextInput,
  Textarea,
  Paper,
  ActionIcon,
  Tooltip,
  Modal,
  Drawer,
  Box,
  ScrollArea,
  Badge,
  Checkbox,
  FileButton,
  Menu,
} from "@mantine/core";
import {
  IconTrash,
  IconPlus,
  IconBrain,
  IconAlertCircle,
  IconSearch,
  IconCopy,
  IconCheck,
  IconDownload,
  IconUpload,
  IconDotsVertical,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { inputStyles } from "@/lib/styles";
import { notifications } from "@mantine/notifications";

interface MemoryHistoryTableProps {
  configId: string;
  organizationId: string;
}

function CopySqlButton({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip label={copied ? "Copied!" : "Copy SQL"} position="top" withArrow>
      <ActionIcon
        variant="subtle"
        color={copied ? "green" : "gray"}
        onClick={handleCopy}
        size="sm"
        style={{
          opacity: 0.8,
          transition: "all 0.2s ease",
        }}
      >
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function MemoryHistoryTable({ configId, organizationId }: MemoryHistoryTableProps) {
  const memories = useQuery(api.semanticMemory.listByConfig, { configId: configId as Id<"databaseConfigs"> });
  const deleteMutation = useMutation(api.semanticMemory.remove);
  const deleteBulkMutation = useMutation(api.semanticMemory.removeBulk);
  const createMutation = useMutation(api.semanticMemory.createManualMapping);
  const bulkCreateMutation = useMutation(api.semanticMemory.bulkCreateManualMappings);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [viewSqlModal, setViewSqlModal] = useState<{ question: string; sql: string } | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"semanticMemory"> | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Id<"semanticMemory">[]>([]);

  const handleAddMemory = async () => {
    if (!question.trim() || !sql.trim()) {
      notifications.show({ title: "Validation Error", message: "Question and SQL are required.", color: "orange" });
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation({
        organizationId: organizationId as Id<"organizations">,
        configId: configId as Id<"databaseConfigs">,
        question: question.trim(),
        sql: sql.trim(),
      });
      notifications.show({ title: "Seed Created", message: "Manual query mapping successfully saved and embedding indexing scheduled.", color: "green" });
      setAddModalOpen(false);
      setQuestion("");
      setSql("");
    } catch (err: any) {
      notifications.show({ title: "Creation Failed", message: err.message || "Could not save mapping.", color: "red" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation({
        id: deletingId,
        organizationId: organizationId as Id<"organizations">,
      });
      notifications.show({ title: "Mapping Purged", message: "Successfully deleted memory mapping.", color: "red" });
      setSelectedIds(prev => prev.filter(item => item !== deletingId));
      setDeletingId(null);
    } catch (err: any) {
      notifications.show({ title: "Deletion Failed", message: err.message || "Could not delete mapping.", color: "red" });
    }
  };

  const confirmBulkDelete = async () => {
    try {
      await deleteBulkMutation({
        ids: selectedIds,
        organizationId: organizationId as Id<"organizations">,
      });
      notifications.show({ title: "Seeds Purged", message: `Successfully deleted ${selectedIds.length} query mappings.`, color: "red" });
      setSelectedIds([]);
      setBulkDeleting(false);
    } catch (err: any) {
      notifications.show({ title: "Bulk Deletion Failed", message: err.message || "Could not delete mappings.", color: "red" });
    }
  };

  const handleExportCSV = () => {
    if (!memories || memories.length === 0) {
      notifications.show({ title: "No Data", message: "There are no query seeds to export.", color: "orange" });
      return;
    }

    const headers = ["Natural Language Question", "SQL Query", "Created At"];
    const rows = memories.map((m) => [
      m.question,
      m.sql,
      new Date((m as any)._creationTime || Date.now()).toISOString(),
    ]);

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orcha_query_seeds_${configId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifications.show({ title: "Export Succeeded", message: "Successfully exported query seeds to CSV.", color: "green" });
  };

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let col = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            col += '"'; // Escaped quote
            i++;
          } else {
            inQuotes = false; // Close quote
          }
        } else {
          col += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true; // Open quote
        } else if (char === ',') {
          row.push(col.trim());
          col = "";
        } else if (char === '\n' || char === '\r') {
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
          row.push(col.trim());
          result.push(row);
          row = [];
          col = "";
        } else {
          col += char;
        }
      }
    }

    if (col || row.length > 0) {
      row.push(col.trim());
      result.push(row);
    }

    return result.filter((r) => r.length > 0 && r.some((cell) => cell.trim() !== ""));
  };

  const handleImportCSV = async (file: File | null) => {
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const parsedRows = parseCSV(text);

      if (parsedRows.length <= 1) {
        notifications.show({ title: "Import Failed", message: "CSV file is empty or lacks data rows.", color: "red" });
        setIsImporting(false);
        return;
      }

      // Check if the first row is a header
      const firstRow = parsedRows[0].map((h) => h.toLowerCase());
      let questionIdx = 0;
      let sqlIdx = 1;
      let startRow = 0;

      const hasHeaders = firstRow.some((col) => col.includes("question") || col.includes("sql") || col.includes("query"));
      if (hasHeaders) {
        startRow = 1;
        questionIdx = firstRow.findIndex((col) => col.includes("question") || col.includes("pattern") || col.includes("natural language"));
        sqlIdx = firstRow.findIndex((col) => col.includes("sql") || col.includes("query"));

        if (questionIdx === -1 || sqlIdx === -1) {
          notifications.show({
            title: "Invalid Headers",
            message: "CSV must contain columns named 'question' (or 'natural language') and 'sql' (or 'query').",
            color: "orange",
          });
          setIsImporting(false);
          return;
        }
      }

      const mappings = [];
      for (let i = startRow; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const questionText = row[questionIdx]?.trim();
        const sqlText = row[sqlIdx]?.trim();

        if (questionText && sqlText) {
          mappings.push({ question: questionText, sql: sqlText });
        }
      }

      if (mappings.length === 0) {
        notifications.show({ title: "Import Failed", message: "No valid question-SQL query mappings found in the CSV.", color: "orange" });
        setIsImporting(false);
        return;
      }

      await bulkCreateMutation({
        organizationId: organizationId as Id<"organizations">,
        configId: configId as Id<"databaseConfigs">,
        mappings,
      });

      notifications.show({
        title: "Import Succeeded",
        message: `Successfully imported ${mappings.length} query seeds and scheduled embedding indexing.`,
        color: "green",
      });
    } catch (err: any) {
      notifications.show({ title: "Import Failed", message: err.message || "Failed to process the CSV file.", color: "red" });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredMemories = memories?.filter((m) => {
    const q = m.question.toLowerCase();
    const s = m.sql.toLowerCase();
    const query = searchQuery.toLowerCase();
    return q.includes(query) || s.includes(query);
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredMemories) {
      setSelectedIds(filteredMemories.map((m) => m._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: Id<"semanticMemory">, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const allFilteredSelected = filteredMemories && filteredMemories.length > 0 && 
    filteredMemories.every((m) => selectedIds.includes(m._id));

  const someFilteredSelected = filteredMemories && filteredMemories.length > 0 && 
    filteredMemories.some((m) => selectedIds.includes(m._id)) && !allFilteredSelected;

  const rows = filteredMemories?.map((m) => {
    const isLongSql = m.sql.length > 50;
    const displaySql = isLongSql ? m.sql.substring(0, 50) + "..." : m.sql;
    const isChecked = selectedIds.includes(m._id);

    const sqlContent = (
      <Box
        p="xs"
        onClick={() => {
          if (isLongSql) {
            setViewSqlModal({ question: m.question, sql: m.sql });
          }
        }}
        style={{
          background: "var(--orcha-bg)",
          borderRadius: "8px",
          border: "1px solid var(--orcha-border)",
          position: "relative",
          cursor: isLongSql ? "pointer" : "default",
          transition: "all 0.2s ease",
        }}
        className={isLongSql ? "hover:bg-white/[0.04] dark:hover:bg-white/[0.03]" : ""}
      >
        <Group 
          style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
          onClick={(e) => e.stopPropagation()} // Prevent modal trigger on copy button click
        >
          <CopySqlButton sql={m.sql} />
        </Group>
        <Text 
          size="xs" 
          ff="monospace" 
          c="var(--orcha-purple)" 
          style={{ 
            whiteSpace: "pre-wrap", 
            maxWidth: 500, 
            overflowX: "auto",
            paddingRight: "28px",
            lineHeight: 1.6
          }}
        >
          {displaySql}
        </Text>
      </Box>
    );

    return (
      <Table.Tr 
        key={m._id} 
        style={{ 
          borderBottom: "1px solid var(--orcha-border)",
          transition: "background-color 0.2s ease",
          background: isChecked ? "rgba(168, 85, 247, 0.03)" : "transparent",
        }}
        className="hover:bg-white/[0.02] dark:hover:bg-white/[0.01]"
      >
        <Table.Td style={{ width: "40px", padding: "16px 12px", verticalAlign: "middle" }}>
          <Checkbox
            color="violet"
            checked={isChecked}
            onChange={(e) => handleSelectRow(m._id, e.currentTarget.checked)}
          />
        </Table.Td>
        <Table.Td style={{ verticalAlign: "top", padding: "16px 12px" }}>
          <Text size="sm" fw={600} c="var(--orcha-text-title)" style={{ maxWidth: 300, whiteSpace: "normal", lineHeight: 1.5 }}>
            {m.question}
          </Text>
        </Table.Td>
        <Table.Td style={{ verticalAlign: "top", padding: "16px 12px" }}>
          {isLongSql ? (
            <Tooltip label="Click to view full SQL" position="top" withArrow>
              {sqlContent}
            </Tooltip>
          ) : sqlContent}
        </Table.Td>
        <Table.Td style={{ verticalAlign: "middle", textAlign: "right", padding: "16px 12px" }}>
          <Tooltip label="Delete Mapping" position="left" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => setDeletingId(m._id)}
              styles={{ 
                root: { 
                  transition: "all 0.2s ease",
                  "&:hover": {
                    background: "rgba(239, 68, 68, 0.1)",
                  }
                } 
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Box>
          <Group gap={8} align="center">
            <IconBrain size={20} color="#a855f7" />
            <Text size="md" fw={700} c="var(--orcha-text-title)">
              Few-Shot Query Seeds
            </Text>
            {memories && memories.length > 0 && (
              <Badge variant="light" color="violet" size="sm" radius="sm">
                {memories.length} {memories.length === 1 ? "seed" : "seeds"}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            NL-to-SQL query pairs recalled dynamically to guide AI agent intelligence and prevent hallucinations.
          </Text>
        </Box>
        <Menu shadow="md" width={180} position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="light" color="violet" size="lg" radius="md">
              <IconDotsVertical size={20} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown style={{ background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" }}>
            <Menu.Item
              leftSection={<IconPlus size={14} />}
              onClick={() => setAddModalOpen(true)}
              styles={{
                item: { color: "var(--orcha-text-title)" }
              }}
            >
              Add Manual Seed
            </Menu.Item>
            
            <FileButton onChange={handleImportCSV} accept=".csv">
              {(props) => (
                <Menu.Item
                  {...props}
                  leftSection={<IconUpload size={14} />}
                  styles={{
                    item: { color: "var(--orcha-text-title)" }
                  }}
                >
                  Import CSV
                </Menu.Item>
              )}
            </FileButton>

            {memories && memories.length > 0 && (
              <Menu.Item
                leftSection={<IconDownload size={14} />}
                onClick={handleExportCSV}
                styles={{
                  item: { color: "var(--orcha-text-title)" }
                }}
              >
                Export CSV
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Paper withBorder p="md" radius="lg" style={{ background: "var(--orcha-panel)", overflow: "hidden" }}>
        {memories === undefined ? (
          <Group justify="center" py="xl">
            <Text size="xs" c="dimmed">Syncing query history index...</Text>
          </Group>
        ) : memories.length === 0 ? (
          <Group justify="center" py="4rem">
            <Stack align="center" gap="sm">
              <IconAlertCircle size={32} color="var(--orcha-text-muted)" style={{ opacity: 0.6 }} />
              <Text size="sm" c="dimmed" fw={500}>No query seeds recorded yet.</Text>
              <Text size="xs" c="dimmed" style={{ maxWidth: 300, textAlign: "center" }}>
                Ask the AI agent a question to record query memory naturally, or add a manual seed.
              </Text>
            </Stack>
          </Group>
        ) : (
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <TextInput
                placeholder="Search query seeds by question or SQL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<IconSearch size={14} color="var(--orcha-text-muted)" />}
                styles={{
                  label: inputStyles.label,
                  input: {
                    ...inputStyles.input,
                    background: "var(--orcha-panel)",
                  }
                }}
                size="xs"
                style={{ width: "100%", maxWidth: 350 }}
              />

              {selectedIds.length > 0 && (
                <Button
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setBulkDeleting(true)}
                  variant="light"
                  styles={{
                    root: {
                      transition: "transform 0.15s ease",
                      "&:hover": {
                        transform: "translateY(-1px)",
                      }
                    }
                  }}
                >
                  Bulk Delete ({selectedIds.length})
                </Button>
              )}
            </Group>

            <ScrollArea h={340} offsetScrollbars>
              <Table variant="unstyled" style={{ width: "100%", borderCollapse: "collapse" }}>
                <Table.Thead>
                  <Table.Tr style={{ borderBottom: "1px solid var(--orcha-border)" }}>
                    <Table.Th style={{ width: "40px", padding: "10px 12px" }}>
                      <Checkbox
                        color="violet"
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected}
                        onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                      />
                    </Table.Th>
                    <Table.Th style={{ width: "30%", padding: "10px 12px" }}>
                      <Text size="10px" fw={700} c="dimmed" style={{ letterSpacing: "0.05em" }}>
                        NATURAL LANGUAGE QUESTION
                      </Text>
                    </Table.Th>
                    <Table.Th style={{ width: "55%", padding: "10px 12px" }}>
                      <Text size="10px" fw={700} c="dimmed" style={{ letterSpacing: "0.05em" }}>
                        APPROVED DIALECT SQL
                      </Text>
                    </Table.Th>
                    <Table.Th style={{ width: "10%", textAlign: "right", padding: "10px 12px" }}>
                      <Text size="10px" fw={700} c="dimmed" style={{ letterSpacing: "0.05em" }}>
                        ACTIONS
                      </Text>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows && rows.length > 0 ? rows : (
                    <Table.Tr>
                      <Table.Td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                        <Text size="xs" c="dimmed">No query seeds matched your search query.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        )}
      </Paper>

      {/* Drawer: Add Manual Query Seed */}
      <Drawer
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Manual Query Memory Seed"
        position="right"
        size="md"
        styles={{
          content: { background: "var(--orcha-panel)", borderLeft: "1px solid var(--orcha-border)" },
          header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)" },
          title: { color: "var(--orcha-text-title)", fontWeight: 700 }
        }}
      >
        <Stack gap="md" pt="md">
          <Text size="xs" c="dimmed">
            Directly teach the AI agent how to translate specific queries. The agent will fetch this SQL whenever a user asks a similar question.
          </Text>

          <TextInput
            label="Natural Language Question"
            placeholder="e.g. List all active enterprise customers in APAC region"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            styles={{
              label: inputStyles.label,
              input: {
                ...inputStyles.input,
                background: "var(--orcha-panel)",
              }
            }}
            required
          />

          <Textarea
            label="Approved Dialect SQL Query"
            placeholder="e.g. SELECT * FROM customers WHERE plan = 'enterprise' AND region = 'APAC'..."
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            minRows={10}
            styles={{
              label: inputStyles.label,
              input: {
                ...inputStyles.input,
                background: "var(--orcha-panel)",
              }
            }}
            required
            ff="monospace"
          />

          <Group justify="flex-end" gap="md" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="violet"
              size="xs"
              loading={isSubmitting}
              onClick={handleAddMemory}
            >
              Save Memory Seed
            </Button>
          </Group>
        </Stack>
      </Drawer>

      {/* Modal: View Full SQL */}
      <Modal
        opened={viewSqlModal !== null}
        onClose={() => setViewSqlModal(null)}
        title={
          <Group gap={8} align="center">
            <IconBrain size={18} color="#a855f7" />
            <Text size="sm" fw={700} c="var(--orcha-text-title)" style={{ maxWidth: "450px", whiteSpace: "normal" }}>
              {viewSqlModal?.question}
            </Text>
          </Group>
        }
        centered
        radius="lg"
        size="lg"
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
          header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)" },
          title: { color: "var(--orcha-text-title)" }
        }}
      >
        <Stack gap="md" pt="xs">
          <Text size="xs" c="dimmed">
            Approved query translation memory for the above natural language question:
          </Text>

          <Box
            p="md"
            style={{
              background: "var(--orcha-bg)",
              borderRadius: "8px",
              border: "1px solid var(--orcha-border)",
              position: "relative",
            }}
          >
            <Group style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
              <CopySqlButton sql={viewSqlModal?.sql || ""} />
            </Group>
            <Text 
              size="xs" 
              ff="monospace" 
              c="var(--orcha-purple)" 
              style={{ 
                whiteSpace: "pre-wrap", 
                maxHeight: "350px", 
                overflowY: "auto",
                paddingRight: "36px",
                lineHeight: 1.6
              }}
            >
              {viewSqlModal?.sql}
            </Text>
          </Box>

          <Group justify="flex-end" mt="sm">
            <Button variant="light" color="violet" size="xs" onClick={() => setViewSqlModal(null)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        opened={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Query Memory Seed"
        centered
        size="sm"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", borderRadius: 12 },
          header: { background: "var(--orcha-panel)", color: "var(--orcha-text-title)" },
          title: { fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="var(--orcha-text-body)">
            Are you sure you want to delete this query memory seed? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setDeletingId(null)} size="xs">
              Cancel
            </Button>
            <Button color="red" onClick={confirmDelete} size="xs">
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Bulk Delete Confirmation */}
      <Modal
        opened={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        title="Bulk Delete Query Memory Seeds"
        centered
        size="sm"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", borderRadius: 12 },
          header: { background: "var(--orcha-panel)", color: "var(--orcha-text-title)" },
          title: { fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="var(--orcha-text-body)">
            Are you sure you want to delete the {selectedIds.length} selected query memory seeds? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setBulkDeleting(false)} size="xs">
              Cancel
            </Button>
            <Button color="red" onClick={confirmBulkDelete} size="xs">
              Delete All
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
