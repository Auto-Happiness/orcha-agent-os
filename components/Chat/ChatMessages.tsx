"use client";

import { Stack, Group, Avatar, Text, Box, Button, ScrollArea, Loader, Modal } from "@mantine/core";
import { IconUser, IconSparkles, IconTableExport, IconDatabase, IconCode, IconDownload, IconBookmark, IconCheck } from "@tabler/icons-react";
import { UIMessage } from "ai";
import { useCallback, useState, memo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  showResults: boolean;
  organizationId?: string;
  configId?: string | null;
}

// ── DataTable ────────────────────────────────────────────────────────────────

const DataTable = memo(function DataTable({ data, sql, organizationId, configId }: {
  data: any[];
  sql?: string;
  organizationId?: string;
  configId?: string | null;
}) {
  const columns = Object.keys(data[0]);
  const hasMore = data.length >= 50;

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
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, organizationId, configId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  }, [sql, organizationId, configId]);

  return (
    <Box style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(147,51,234,0.18)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(147,51,234,0.06)" }}>
      {/* Toolbar */}
      <Box style={{ background: "rgba(19,16,42,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(147,51,234,0.12)", padding: "10px 16px" }}>
        <Group justify="space-between">
          <Group gap={10}>
            <Group gap={5}>
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(147,51,234,0.6)", boxShadow: "0 0 8px rgba(147,51,234,0.8)" }} />
            </Group>
            <Box style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
            <Text size="11px" fw={600} c="rgba(192,132,252,0.8)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>Result Set</Text>
            <Box style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(147,51,234,0.12)", border: "1px solid rgba(147,51,234,0.2)" }}>
              <Text size="10px" fw={700} c="violet.4">{data.length.toLocaleString()} rows · {columns.length} cols</Text>
            </Box>
          </Group>
          <Button variant="subtle" size="compact-xs" color="violet" radius="md" leftSection={<IconTableExport size={11} />} onClick={exportPreviewCsv} styles={{ root: { fontSize: 11, opacity: 0.7 } }}>
            Export preview
          </Button>
        </Group>
      </Box>

      {/* Table */}
      <ScrollArea>
        <Box style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,8,20,0.8)" }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "9px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", fontWeight: 500, borderBottom: "1px solid rgba(147,51,234,0.12)", background: "rgba(147,51,234,0.04)", userSelect: "none" }}>#</th>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(192,132,252,0.75)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid rgba(147,51,234,0.12)", borderLeft: "1px solid rgba(255,255,255,0.03)", background: "rgba(147,51,234,0.04)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(147,51,234,0.06)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; }}
                >
                  <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", borderBottom: "1px solid rgba(255,255,255,0.03)", userSelect: "none" }}>{ri + 1}</td>
                  {columns.map((col, ci) => {
                    const val = row[col];
                    const isNull = val == null;
                    const isNum = !isNull && typeof val === "number";
                    return (
                      <td key={ci} style={{ padding: "7px 16px", fontSize: 12, color: isNull ? "rgba(255,255,255,0.2)" : isNum && val < 0 ? "#f87171" : isNum ? "#a5f3fc" : "rgba(255,255,255,0.82)", fontStyle: isNull ? "italic" : "normal", fontFamily: isNum ? "var(--font-geist-mono,monospace)" : "inherit", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.03)", textAlign: isNum ? "right" : "left" }}>
                        {isNull ? "null" : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </ScrollArea>

      {/* Footer */}
      {hasMore && (
        <Box style={{ padding: "8px 16px", borderTop: "1px solid rgba(147,51,234,0.1)", background: "rgba(19,16,42,0.6)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Group gap={6}>
            <Box style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(147,51,234,0.5)" }} />
            <Text size="11px" c="dimmed">Showing {data.length} rows (limit reached — download for full dataset)</Text>
          </Group>
          {sql && (
            <Button size="compact-xs" variant="light" color="violet" radius="md" leftSection={<IconDownload size={11} />} onClick={exportFullCsv} styles={{ root: { fontSize: 11 } }}>
              Download full dataset
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractSQLFromParts(parts: any[]): string[] {
  const queries: string[] = [];
  for (const part of parts) {
    const type: string = part.type ?? "";
    let sql: string | undefined;
    if (type === "tool-execute_sql") sql = part.input?.sql;
    else if (type === "tool-invocation" && part.toolInvocation?.toolName === "execute_sql")
      sql = part.toolInvocation.input?.sql ?? part.toolInvocation.args?.sql;
    else if (type === "tool-result" && part.toolName === "execute_sql")
      sql = part.input?.sql ?? part.args?.sql;
    if (sql && !queries.includes(sql)) queries.push(sql);
  }
  return queries;
}

function renderToolPart(part: any, i: number, showResults: boolean, organizationId?: string, configId?: string | null) {
  const type: string = part.type ?? "";

  if (
    type === "tool-call" ||
    (type === "tool-invocation" && (part.toolInvocation?.state === "call" || part.toolInvocation?.state === "partial-call")) ||
    type.startsWith("tool-input") ||
    (type === "tool-execute_sql" && part.state === "input-streaming")
  ) {
    return (
      <Box key={i} ml="3rem" mt="xs">
        <Group gap={6}>
          <IconDatabase size={13} color="#a855f7" />
          <Loader size="xs" color="violet" type="dots" />
          <Text size="xs" c="dimmed">Running query...</Text>
        </Group>
      </Box>
    );
  }

  let result: any = null;
  if (type === "tool-execute_sql" && part.state === "output-available") result = part.output;
  else if (type === "tool-result") result = part.result;
  else if (type === "tool-invocation" && part.toolInvocation?.state === "result") result = part.toolInvocation.result;
  else if (type === "tool-output-available") result = part.output;

  if (!result) return null;

  if (result.success === false) {
    return <Box key={i} ml="3rem" mt="xs"><Text size="xs" c="red.4">SQL Error: {result.error}</Text></Box>;
  }

  const partSql = type === "tool-execute_sql" ? part.input?.sql : undefined;

  if (result.success && result.data?.length > 0) {
    if (!showResults) return null;
    return (
      <Box key={i} ml="3rem" mt="sm">
        <DataTable data={result.data} sql={partSql} organizationId={organizationId} configId={configId} />
      </Box>
    );
  }

  if (result.success && result.data?.length === 0) {
    return <Box key={i} ml="3rem" mt="xs"><Text size="xs" c="dimmed">Query returned no rows.</Text></Box>;
  }

  return null;
}

// ── SQLModal ─────────────────────────────────────────────────────────────────

function SQLModal({ queries, opened, onClose, organizationId, configId }: {
  queries: string[]; opened: boolean; onClose: () => void;
  organizationId?: string; configId?: string | null;
}) {
  const saveQuery = useMutation(api.savedQueries.save);
  const currentUser = useQuery(api.users.getCurrentUser);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const handleSave = async (sql: string, idx: number) => {
    if (!organizationId || !configId || !currentUser?._id) return;
    setSaving(idx);
    try {
      await saveQuery({
        organizationId: organizationId as any,
        configId: configId as any,
        name: `Query ${new Date().toLocaleString()}`,
        sql,
        createdBy: currentUser._id,
      });
      setSaved(prev => new Set(prev).add(idx));
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
                    onClick={() => handleSave(sql, i)}
                  >
                    {saved.has(i) ? "Saved" : "Save Query"}
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Stack>
    </Modal>
  );
}

// ── MessageRow (memoized — only re-renders when its own message changes) ─────

const MessageRow = memo(function MessageRow({ m, showResults, organizationId, configId, onViewSql }: {
  m: any; showResults: boolean; organizationId?: string; configId?: string | null; onViewSql: (q: string[]) => void;
}) {
  const sqlQueries = m.role === "assistant" ? extractSQLFromParts(m.parts as any[]) : [];
  return (
    <Stack gap="sm">
      <Group gap="md" align="flex-start" wrap="nowrap">
        <Avatar size="md" radius="xl" color={m.role === "user" ? "blue" : "violet"} style={{ background: m.role === "user" ? "rgba(37,99,235,0.1)" : "transparent", flexShrink: 0 }}>
          {m.role === "user" ? <IconUser size={20} /> : <IconSparkles size={24} style={{ color: "#a855f7" }} />}
        </Avatar>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" c="white">{m.role === "user" ? "You" : "Orcha Agent"}</Text>
          {m.parts.map((part: any, i: number) =>
            part.type === "text" && part.text
              ? <Text key={i} size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{part.text}</Text>
              : null
          )}
          {sqlQueries.length > 0 && (
            <Box mt={6}>
              <Button size="compact-xs" variant="subtle" color="violet" radius="md" leftSection={<IconCode size={11} />} onClick={() => onViewSql(sqlQueries)} styles={{ root: { fontSize: 11, opacity: 0.6 } }}>
                View SQL
              </Button>
            </Box>
          )}
        </Stack>
      </Group>
      {(m.parts as any[]).map((part: any, i: number) => renderToolPart(part, i, showResults, organizationId, configId))}
    </Stack>
  );
});

// ── ChatMessages ─────────────────────────────────────────────────────────────

export function ChatMessages({ messages, isLoading, showResults, organizationId, configId }: ChatMessagesProps) {
  const [sqlModal, setSqlModal] = useState<string[] | null>(null);

  return (
    <>
      {messages.map((m) => (
        <MessageRow key={m.id} m={m} showResults={showResults} organizationId={organizationId} configId={configId} onViewSql={setSqlModal} />
      ))}

      {isLoading && (
        <Group gap="md" align="flex-start" wrap="nowrap">
          <Avatar size="md" radius="xl" color="violet" style={{ background: "transparent" }}>
            <IconSparkles size={24} style={{ color: "#a855f7" }} />
          </Avatar>
          <Stack gap={4} py={8}>
            <Text fw={700} size="sm" c="white">Orcha Agent</Text>
            <Loader size="xs" color="violet" type="dots" />
          </Stack>
        </Group>
      )}

      <SQLModal queries={sqlModal ?? []} opened={sqlModal !== null} onClose={() => setSqlModal(null)} organizationId={organizationId} configId={configId} />
    </>
  );
}
