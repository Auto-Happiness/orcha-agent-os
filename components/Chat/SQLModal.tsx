"use client";

import React, { useState, useEffect } from "react";
import { Modal, Group, Text, Stack, Box, TextInput, Button } from "@mantine/core";
import { IconCode, IconCheck, IconBookmark } from "@tabler/icons-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function SQLModal({ queries, opened, onClose, organizationId, configId }: {
  queries: string[];
  opened: boolean;
  onClose: () => void;
  organizationId?: string;
  configId?: string | null;
}) {
  const saveQuery = useMutation(api.savedQueries.save);
  const currentUser = useQuery(api.users.getCurrentUser);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [activeSaveIdx, setActiveSaveIdx] = useState<number | null>(null);
  const [queryName, setQueryName] = useState("");

  useEffect(() => {
    if (!opened) {
      setActiveSaveIdx(null);
      setQueryName("");
    }
  }, [opened]);

  const handleSave = async (sql: string, idx: number) => {
    if (!organizationId || !configId || !currentUser?._id) return;
    setSaving(idx);
    try {
      await saveQuery({
        organizationId: organizationId as any,
        configId: configId as any,
        name: queryName.trim() || `Query ${new Date().toLocaleString()}`,
        sql,
        createdBy: currentUser._id,
      });
      setSaved(prev => new Set(prev).add(idx));
      setActiveSaveIdx(null);
    } catch (e: any) {
      console.error("[SQLModal] Save failed:", e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose}
      title={<Group gap={8}><IconCode size={16} color="#a855f7" /><Text size="sm" fw={600} c="white">SQL Queries</Text></Group>}
      size="lg" radius="md"
      styles={{ content: { background: "#0d0a1a", border: "1px solid rgba(147,51,234,0.2)" }, header: { background: "#0d0a1a", borderBottom: "1px solid rgba(147,51,234,0.1)" }, title: { color: "white" } }}
    >
      <Stack gap="md" pt="xs">
        {queries.map((sql, i) => (
          <Box key={i}>
            {queries.length > 1 && <Text size="10px" fw={700} c="violet.4" mb={6} style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Query {i + 1}</Text>}
            <Box style={{ borderRadius: 8, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(147,51,234,0.15)", overflow: "hidden" }}>
              <Box style={{ padding: "10px 14px", fontFamily: "var(--font-geist-mono,monospace)", fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{sql}</Box>
              
              {activeSaveIdx === i ? (
                <Box style={{ borderTop: "1px solid rgba(147,51,234,0.1)", padding: "8px 12px", background: "rgba(147,51,234,0.03)" }}>
                  <Group gap={8} wrap="nowrap" style={{ width: "100%" }}>
                    <TextInput
                      placeholder="Enter query name..."
                      value={queryName}
                      onChange={(e) => setQueryName(e.currentTarget.value)}
                      size="xs"
                      radius="md"
                      autoFocus
                      style={{ flex: 1 }}
                      styles={{
                        input: {
                          background: "rgba(0, 0, 0, 0.4)",
                          border: "1px solid rgba(147, 51, 234, 0.3)",
                          color: "white",
                          "&:focus": {
                            borderColor: "#a855f7",
                          }
                        }
                      }}
                    />
                    <Button
                      size="compact-xs"
                      variant="filled"
                      color="violet"
                      radius="md"
                      loading={saving === i}
                      onClick={() => handleSave(sql, i)}
                    >
                      Save
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="dimmed"
                      radius="md"
                      onClick={() => setActiveSaveIdx(null)}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Box>
              ) : (
                <Box style={{ borderTop: "1px solid rgba(147,51,234,0.1)", padding: "6px 10px", display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <Button size="compact-xs" variant="subtle" color="dimmed" onClick={() => navigator.clipboard.writeText(sql)}>Copy</Button>
                  {organizationId && configId && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color={saved.has(i) ? "green" : "violet"}
                      loading={saving === i}
                      disabled={saved.has(i)}
                      leftSection={saved.has(i) ? <IconCheck size={11} /> : <IconBookmark size={11} />}
                      onClick={() => {
                        setActiveSaveIdx(i);
                        setQueryName(`Query ${new Date().toLocaleDateString()}`);
                      }}
                    >
                      {saved.has(i) ? "Saved" : "Save Query"}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    </Modal>
  );
}
