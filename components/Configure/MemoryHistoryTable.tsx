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
  Divider,
} from "@mantine/core";
import { IconTrash, IconPlus, IconBrain, IconCode, IconAlertCircle } from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { inputStyles } from "@/lib/styles";
import { notifications } from "@mantine/notifications";

interface MemoryHistoryTableProps {
  configId: string;
  organizationId: string;
}

export function MemoryHistoryTable({ configId, organizationId }: MemoryHistoryTableProps) {
  const memories = useQuery(api.semanticMemory.listByConfig, { configId: configId as any });
  const deleteMutation = useMutation(api.semanticMemory.remove);
  const createMutation = useMutation(api.semanticMemory.createManualMapping);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMemory = async () => {
    if (!question.trim() || !sql.trim()) {
      notifications.show({ title: "Validation Error", message: "Question and SQL are required.", color: "orange" });
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation({
        organizationId: organizationId as any,
        configId: configId as any,
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

  const handleDeleteMemory = async (id: any) => {
    try {
      await deleteMutation({
        id,
        organizationId: organizationId as any,
      });
      notifications.show({ title: "Mapping Purged", message: "Successfully deleted memory mapping.", color: "red" });
    } catch (err: any) {
      notifications.show({ title: "Deletion Failed", message: err.message || "Could not delete mapping.", color: "red" });
    }
  };

  const rows = memories?.map((m) => (
    <Table.Tr key={m._id} style={{ borderBottom: "1px solid var(--orcha-border)" }}>
      <Table.Td style={{ verticalAlign: "top", py: "md" }}>
        <Text size="xs" fw={600} c="var(--orcha-text-title)" style={{ maxWidth: 300, whiteSpace: "normal" }}>
          {m.question}
        </Text>
      </Table.Td>
      <Table.Td style={{ verticalAlign: "top", py: "md" }}>
        <Box
          p="xs"
          style={{
            background: "var(--orcha-panel)",
            borderRadius: "6px",
            border: "1px solid var(--orcha-border)",
          }}
        >
          <Text size="xs" ff="monospace" c="var(--orcha-purple)" style={{ whiteSpace: "pre-wrap", maxWidth: 500, overflowX: "auto" }}>
            {m.sql}
          </Text>
        </Box>
      </Table.Td>
      <Table.Td style={{ verticalAlign: "middle", textAlign: "right" }}>
        <Tooltip label="Delete Mapping" position="left" withArrow>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDeleteMemory(m._id)}
            styles={{ root: { transition: "all 0.2s ease" } }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Box>
          <Group gap={8}>
            <IconBrain size={18} color="#a855f7" />
            <Text size="sm" fw={700} c="var(--orcha-text-title)">Few-Shot Query Seeds (Recall Memory)</Text>
          </Group>
          <Text size="11px" c="dimmed" mt={2}>
            Past NL-to-SQL query pairs recalled to guide prompt intelligence and prevent database structural hallucinations.
          </Text>
        </Box>
        <Button
          variant="light"
          color="violet"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Manual Seed
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md" style={{ background: "var(--orcha-panel)" }}>
        {memories === undefined ? (
          <Group justify="center" py="xl"><Text size="xs" c="dimmed">Syncing query history index...</Text></Group>
        ) : memories.length === 0 ? (
          <Group justify="center" py="3rem">
            <Stack align="center" gap="xs">
              <IconAlertCircle size={28} color="var(--orcha-text-muted)" />
              <Text size="xs" c="dimmed">No query seeds recorded yet. Use the agent or create a manual seed.</Text>
            </Stack>
          </Group>
        ) : (
          <ScrollArea h={320} offsetScrollbars>
            <Table variant="unstyled" style={{ width: "100%" }}>
              <Table.Thead>
                <Table.Tr style={{ borderBottom: "1px solid var(--orcha-border)" }}>
                  <Table.Th style={{ width: "35%" }}><Text size="10px" fw={700} c="dimmed">NATURAL LANGUAGE QUESTION</Text></Table.Th>
                  <Table.Th style={{ width: "55%" }}><Text size="10px" fw={700} c="dimmed">APPROVED DIALECT SQL</Text></Table.Th>
                  <Table.Th style={{ width: "10%", textAlign: "right" }}><Text size="10px" fw={700} c="dimmed">ACTIONS</Text></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Modal: Add Manual Query Seed */}
      <Modal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Manual Query Memory Seed"
        centered
        radius="md"
        size="lg"
        styles={{
          content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)" },
          header: { background: "var(--orcha-panel)", borderBottom: "1px solid var(--orcha-border)" },
          title: { color: "var(--orcha-text-title)", fontWeight: 700 }
        }}
      >
        <Stack gap="md" pt="xs">
          <Text size="xs" c="dimmed">
            Directly teach the AI agent how to translate specific queries. The agent will fetch this SQL whenever a user asks a similar question.
          </Text>

          <TextInput
            label="Natural Language Question"
            placeholder="e.g. List all active enterprise customers in APAC region"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            styles={inputStyles}
            required
          />

          <Textarea
            label="Approved Dialect SQL Query"
            placeholder="e.g. SELECT * FROM customers WHERE plan = 'enterprise' AND region = 'APAC'..."
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            minRows={5}
            styles={inputStyles}
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
      </Modal>
    </Stack>
  );
}
