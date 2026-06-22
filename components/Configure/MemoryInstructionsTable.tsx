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
  rem,
  Box,
  ScrollArea,
} from "@mantine/core";
import { IconTrash, IconPlus, IconPencil, IconAdjustmentsHorizontal, IconAlertCircle } from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { inputStyles } from "@/lib/styles";
import { notifications } from "@mantine/notifications";

interface MemoryInstructionsTableProps {
  configId: string;
  organizationId: string;
}

export function MemoryInstructionsTable({ configId, organizationId }: MemoryInstructionsTableProps) {
  const instructions = useQuery(api.semanticInstructions.listByConfig, { configId: configId as any });
  const saveMutation = useMutation(api.semanticInstructions.save);
  const deleteMutation = useMutation(api.semanticInstructions.remove);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        id: editingId ? (editingId as any) : undefined,
        organizationId: organizationId as any,
        configId: configId as any,
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

  const handleDeleteInstruction = async (id: any) => {
    try {
      await deleteMutation({
        id,
        organizationId: organizationId as any,
      });
      notifications.show({ title: "Guideline Deleted", message: "Successfully deleted guideline.", color: "red" });
    } catch (err: any) {
      notifications.show({ title: "Failed to Delete", message: err.message || "An error occurred.", color: "red" });
    }
  };

  const rows = instructions?.map((inst) => (
    <Table.Tr key={inst._id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
      <Table.Td style={{ verticalAlign: "top", py: "md" }}>
        <Text size="xs" fw={700} c="white">
          {inst.title}
        </Text>
      </Table.Td>
      <Table.Td style={{ verticalAlign: "top", py: "md" }}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap", maxWidth: 600 }}>
          {inst.content}
        </Text>
      </Table.Td>
      <Table.Td style={{ verticalAlign: "middle", textAlign: "right" }}>
        <Group gap="xs" justify="flex-end">
          <Tooltip label="Edit Guideline" withArrow>
            <ActionIcon
              variant="subtle"
              color="violet"
              onClick={() => handleOpenEdit(inst)}
              styles={{ root: { transition: "all 0.2s ease" } }}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete Guideline" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => handleDeleteInstruction(inst._id)}
              styles={{ root: { transition: "all 0.2s ease" } }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Box>
          <Group gap={8}>
            <IconAdjustmentsHorizontal size={18} color="#a855f7" />
            <Text size="sm" fw={700} c="white">Dynamic Semantic Guidelines & Policies</Text>
          </Group>
          <Text size="11px" c="dimmed" mt={2}>
            Retrieve and inject company policies dynamically based on query contexts (e.g. "Only count active clients").
          </Text>
        </Box>
        <Button
          variant="light"
          color="violet"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={handleOpenAdd}
        >
          Add Guideline
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
        {instructions === undefined ? (
          <Group justify="center" py="xl"><Text size="xs" c="dimmed">Syncing semantic guidelines index...</Text></Group>
        ) : instructions.length === 0 ? (
          <Group justify="center" py="3rem">
            <Stack align="center" gap="xs">
              <IconAlertCircle size={28} color="rgba(255, 255, 255, 0.2)" />
              <Text size="xs" c="dimmed">No custom guidelines defined yet. Create a guideline to route query intent safely.</Text>
            </Stack>
          </Group>
        ) : (
          <ScrollArea h={320} offsetScrollbars>
            <Table variant="unstyled" style={{ width: "100%" }}>
              <Table.Thead>
                <Table.Tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <Table.Th style={{ width: "25%" }}><Text size="10px" fw={700} c="dimmed">GUIDELINE TITLE</Text></Table.Th>
                  <Table.Th style={{ width: "60%" }}><Text size="10px" fw={700} c="dimmed">INSTRUCTION CONTENT</Text></Table.Th>
                  <Table.Th style={{ width: "15%", textAlign: "right" }}><Text size="10px" fw={700} c="dimmed">ACTIONS</Text></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Modal: Add/Edit Guideline */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Business Guideline" : "Create Business Guideline"}
        centered
        radius="md"
        size="lg"
        styles={{
          content: { background: "#0c0814", border: "1px solid rgba(147, 51, 234, 0.2)" },
          header: { background: "#0c0814", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" },
          title: { color: "white", fontWeight: 700 }
        }}
      >
        <Stack gap="md" pt="xs">
          <Text size="xs" c="dimmed">
            Define specific business rules. The AI agent will automatically fetch and apply these guidelines when queries match their semantic context.
          </Text>

          <TextInput
            label="Guideline Title / Context"
            placeholder="e.g. Active Customers Filter"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            styles={inputStyles}
            required
          />

          <Textarea
            label="Instruction Content"
            placeholder="e.g. When counting customers, always filter by status = 'active' and exclude internal @company.com domains..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={4}
            styles={inputStyles}
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
      </Modal>
    </Stack>
  );
}
