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
  IconPencil,
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconSearch,
  IconDownload,
  IconUpload,
  IconDotsVertical,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { inputStyles } from "@/lib/styles";
import { notifications } from "@mantine/notifications";

interface MemoryInstructionsTableProps {
  configId: string;
  organizationId: string;
}

export function MemoryInstructionsTable({ configId, organizationId }: MemoryInstructionsTableProps) {
  const instructions = useQuery(api.semanticInstructions.listByConfig, { configId: configId as Id<"databaseConfigs"> });
  const saveMutation = useMutation(api.semanticInstructions.save);
  const deleteMutation = useMutation(api.semanticInstructions.remove);
  const deleteBulkMutation = useMutation(api.semanticInstructions.removeBulk);
  const bulkSaveMutation = useMutation(api.semanticInstructions.bulkSave);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"semanticInstructions"> | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"semanticInstructions"> | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Id<"semanticInstructions">[]>([]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setModalOpen(true);
  };

  const handleOpenEdit = (inst: any) => {
    setEditingId(inst._id);
    setTitle(inst.title);
    setContent(inst.content);
    setModalOpen(true);
  };

  const handleSaveInstruction = async () => {
    if (!title.trim() || !content.trim()) {
      notifications.show({ title: "Validation Error", message: "Title and Guideline content are required.", color: "orange" });
      return;
    }

    setIsSubmitting(true);
    try {
      await saveMutation({
        id: editingId ? editingId : undefined,
        organizationId: organizationId as Id<"organizations">,
        configId: configId as Id<"databaseConfigs">,
        title: title.trim(),
        content: content.trim(),
      });
      notifications.show({
        title: editingId ? "Guideline Updated" : "Guideline Created",
        message: "Your dynamic business guideline has been successfully registered and embedded.",
        color: "green",
      });
      setModalOpen(false);
      setTitle("");
      setContent("");
      setEditingId(null);
    } catch (err: any) {
      notifications.show({ title: "Failed to Save", message: err.message || "An error occurred.", color: "red" });
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
      notifications.show({ title: "Guideline Deleted", message: "Successfully deleted guideline.", color: "red" });
      setSelectedIds((prev) => prev.filter((item) => item !== deletingId));
      setDeletingId(null);
    } catch (err: any) {
      notifications.show({ title: "Failed to Delete", message: err.message || "An error occurred.", color: "red" });
    }
  };

  const confirmBulkDelete = async () => {
    try {
      await deleteBulkMutation({
        ids: selectedIds,
        organizationId: organizationId as Id<"organizations">,
      });
      notifications.show({ title: "Guidelines Purged", message: `Successfully deleted ${selectedIds.length} guidelines.`, color: "red" });
      setSelectedIds([]);
      setBulkDeleting(false);
    } catch (err: any) {
      notifications.show({ title: "Bulk Deletion Failed", message: err.message || "Could not delete guidelines.", color: "red" });
    }
  };

  const handleExportCSV = () => {
    if (!instructions || instructions.length === 0) {
      notifications.show({ title: "No Data", message: "There are no guidelines to export.", color: "orange" });
      return;
    }

    const headers = ["Guideline Title", "Instruction Content", "Created At"];
    const rows = instructions.map((inst) => [
      inst.title,
      inst.content,
      new Date((inst as any)._creationTime || Date.now()).toISOString(),
    ]);

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orcha_guidelines_${configId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifications.show({ title: "Export Succeeded", message: "Successfully exported guidelines to CSV.", color: "green" });
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
            col += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          col += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
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
      let titleIdx = 0;
      let contentIdx = 1;
      let startRow = 0;

      const hasHeaders = firstRow.some((col) => col.includes("title") || col.includes("guideline") || col.includes("content") || col.includes("instruction"));
      if (hasHeaders) {
        startRow = 1;
        titleIdx = firstRow.findIndex((col) => col.includes("title") || col.includes("context") || col.includes("header"));
        contentIdx = firstRow.findIndex((col) => col.includes("content") || col.includes("guideline") || col.includes("instruction") || col.includes("rule"));

        if (titleIdx === -1 || contentIdx === -1) {
          notifications.show({
            title: "Invalid Headers",
            message: "CSV must contain columns named 'title' (or 'context') and 'content' (or 'guideline').",
            color: "orange",
          });
          setIsImporting(false);
          return;
        }
      }

      const mappings = [];
      for (let i = startRow; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const titleText = row[titleIdx]?.trim();
        const contentText = row[contentIdx]?.trim();

        if (titleText && contentText) {
          mappings.push({ title: titleText, content: contentText });
        }
      }

      if (mappings.length === 0) {
        notifications.show({ title: "Import Failed", message: "No valid title-instruction mappings found in the CSV.", color: "orange" });
        setIsImporting(false);
        return;
      }

      await bulkSaveMutation({
        organizationId: organizationId as Id<"organizations">,
        configId: configId as Id<"databaseConfigs">,
        instructions: mappings,
      });

      notifications.show({
        title: "Import Succeeded",
        message: `Successfully imported ${mappings.length} business guidelines.`,
        color: "green",
      });
    } catch (err: any) {
      notifications.show({ title: "Import Failed", message: err.message || "Failed to process the CSV file.", color: "red" });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredInstructions = instructions?.filter((inst) => {
    const t = inst.title.toLowerCase();
    const c = inst.content.toLowerCase();
    const query = searchQuery.toLowerCase();
    return t.includes(query) || c.includes(query);
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredInstructions) {
      setSelectedIds(filteredInstructions.map((inst) => inst._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: Id<"semanticInstructions">, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const allFilteredSelected = filteredInstructions && filteredInstructions.length > 0 && 
    filteredInstructions.every((inst) => selectedIds.includes(inst._id));

  const someFilteredSelected = filteredInstructions && filteredInstructions.length > 0 && 
    filteredInstructions.some((inst) => selectedIds.includes(inst._id)) && !allFilteredSelected;

  const rows = filteredInstructions?.map((inst) => {
    const isChecked = selectedIds.includes(inst._id);

    return (
      <Table.Tr 
        key={inst._id} 
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
            onChange={(e) => handleSelectRow(inst._id, e.currentTarget.checked)}
          />
        </Table.Td>
        <Table.Td style={{ verticalAlign: "top", padding: "16px 12px" }}>
          <Text size="xs" fw={700} c="var(--orcha-text-title)" style={{ lineHeight: 1.5 }}>
            {inst.title}
          </Text>
        </Table.Td>
        <Table.Td style={{ verticalAlign: "top", padding: "16px 12px" }}>
          <Box
            p="xs"
            style={{
              background: "var(--orcha-bg)",
              borderRadius: "8px",
              border: "1px solid var(--orcha-border)",
              position: "relative",
            }}
          >
            <Text size="xs" c="var(--orcha-purple)" style={{ whiteSpace: "pre-wrap", maxWidth: 600, lineHeight: 1.6 }}>
              {inst.content}
            </Text>
          </Box>
        </Table.Td>
        <Table.Td style={{ verticalAlign: "middle", textAlign: "right", padding: "16px 12px" }}>
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <Tooltip label="Edit Guideline" withArrow>
              <ActionIcon
                variant="subtle"
                color="violet"
                onClick={() => handleOpenEdit(inst)}
                styles={{ 
                  root: { 
                    transition: "all 0.2s ease",
                    "&:hover": {
                      background: "rgba(124, 58, 237, 0.1)",
                    }
                  } 
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete Guideline" withArrow>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => setDeletingId(inst._id)}
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
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Box>
          <Group gap={8} align="center">
            <IconAdjustmentsHorizontal size={20} color="#a855f7" />
            <Text size="md" fw={700} c="var(--orcha-text-title)">
              Dynamic Semantic Guidelines & Policies
            </Text>
            {instructions && instructions.length > 0 && (
              <Badge variant="light" color="violet" size="sm" radius="sm">
                {instructions.length} {instructions.length === 1 ? "guideline" : "guidelines"}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Retrieve and inject company policies dynamically based on query contexts (e.g. "Only count active clients").
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
              onClick={handleOpenAdd}
              styles={{
                item: { color: "var(--orcha-text-title)" }
              }}
            >
              Add Guideline
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

            {instructions && instructions.length > 0 && (
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
        {instructions === undefined ? (
          <Group justify="center" py="xl">
            <Text size="xs" c="dimmed">Syncing semantic guidelines index...</Text>
          </Group>
        ) : instructions.length === 0 ? (
          <Group justify="center" py="4rem">
            <Stack align="center" gap="sm">
              <IconAlertCircle size={32} color="var(--orcha-text-muted)" style={{ opacity: 0.6 }} />
              <Text size="sm" c="dimmed" fw={500}>No custom guidelines defined yet.</Text>
              <Text size="xs" c="dimmed" style={{ maxWidth: 300, textAlign: "center" }}>
                Create a guideline to route query intent safely and prevent hallucinations.
              </Text>
            </Stack>
          </Group>
        ) : (
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <TextInput
                placeholder="Search guidelines by title or content..."
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
                    <Table.Th style={{ width: "25%", padding: "10px 12px" }}>
                      <Text size="10px" fw={700} c="dimmed" style={{ letterSpacing: "0.05em" }}>
                        GUIDELINE TITLE
                      </Text>
                    </Table.Th>
                    <Table.Th style={{ width: "60%", padding: "10px 12px" }}>
                      <Text size="10px" fw={700} c="dimmed" style={{ letterSpacing: "0.05em" }}>
                        INSTRUCTION CONTENT
                      </Text>
                    </Table.Th>
                    <Table.Th style={{ width: "15%", textAlign: "right", padding: "10px 12px" }}>
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
                        <Text size="xs" c="dimmed">No guidelines matched your search query.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        )}
      </Paper>

      {/* Drawer: Add/Edit Guideline */}
      <Drawer
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Business Guideline" : "Create Business Guideline"}
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
            Define specific business rules. The AI agent will automatically fetch and apply these guidelines when queries match their semantic context.
          </Text>

          <TextInput
            label="Guideline Title / Context"
            placeholder="e.g. Active Customers Filter"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            label="Instruction Content"
            placeholder="e.g. When counting customers, always filter by status = 'active' and exclude internal @company.com domains..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={10}
            styles={{
              label: inputStyles.label,
              input: {
                ...inputStyles.input,
                background: "var(--orcha-panel)",
              }
            }}
            required
          />

          <Group justify="flex-end" gap="md" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="violet"
              size="xs"
              loading={isSubmitting}
              onClick={handleSaveInstruction}
            >
              Save Guideline
            </Button>
          </Group>
        </Stack>
      </Drawer>

      {/* Modal: Delete Confirmation */}
      <Modal
        opened={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Business Guideline"
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
            Are you sure you want to delete this business guideline? This action cannot be undone.
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
        title="Bulk Delete Business Guidelines"
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
            Are you sure you want to delete the {selectedIds.length} selected business guidelines? This action cannot be undone.
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
