"use client";

import { Stack, Group, Avatar, Text, Box, Paper, Button, ScrollArea, Loader } from "@mantine/core";
import { IconUser, IconSparkles, IconTableExport, IconDatabase } from "@tabler/icons-react";
import { UIMessage } from "ai";
import { useCallback } from "react";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
}

function DataTable({ data }: { data: any[] }) {
  const columns = Object.keys(data[0]);

  const exportCsv = useCallback(() => {
    const header = columns.join(",");
    const rows = data.map(row => columns.map(c => JSON.stringify(row[c] ?? "")).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_result.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data, columns]);

  const displayed = data.slice(0, 50);

  return (
    <Box style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(147,51,234,0.18)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(147,51,234,0.06)" }}>

      {/* Toolbar */}
      <Box style={{ background: "rgba(19,16,42,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(147,51,234,0.12)", padding: "10px 16px" }}>
        <Group justify="space-between">
          <Group gap={10}>
            {/* Traffic light dots */}
            <Group gap={5}>
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(147,51,234,0.6)", boxShadow: "0 0 8px rgba(147,51,234,0.8)" }} />
            </Group>
            <Box style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
            <Text size="11px" fw={600} c="rgba(192,132,252,0.8)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Result Set
            </Text>
            <Box style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(147,51,234,0.12)", border: "1px solid rgba(147,51,234,0.2)" }}>
              <Text size="10px" fw={700} c="violet.4">{data.length.toLocaleString()} rows · {columns.length} cols</Text>
            </Box>
          </Group>
          <Button
            variant="subtle" size="compact-xs" color="violet" radius="md"
            leftSection={<IconTableExport size={11} />}
            onClick={exportCsv}
            styles={{ root: { fontSize: 11, opacity: 0.7, "&:hover": { opacity: 1 } } }}
          >
            Export CSV
          </Button>
        </Group>
      </Box>

      {/* Table */}
      <ScrollArea>
        <Box style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,8,20,0.8)" }}>
            <thead>
              <tr>
                {/* Row number header */}
                <th style={{ width: 40, padding: "9px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", fontWeight: 500, borderBottom: "1px solid rgba(147,51,234,0.12)", background: "rgba(147,51,234,0.04)", userSelect: "none" }}>
                  #
                </th>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(192,132,252,0.75)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid rgba(147,51,234,0.12)", borderLeft: "1px solid rgba(255,255,255,0.03)", background: "rgba(147,51,234,0.04)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, ri) => (
                <tr
                  key={ri}
                  style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)", cursor: "default" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(147,51,234,0.06)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; }}
                >
                  {/* Row number */}
                  <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.15)", borderBottom: "1px solid rgba(255,255,255,0.03)", fontVariantNumeric: "tabular-nums", userSelect: "none" }}>
                    {ri + 1}
                  </td>
                  {columns.map((col, ci) => {
                    const val = row[col];
                    const isNull = val == null;
                    const isNum = !isNull && typeof val === "number";
                    const isNegative = isNum && val < 0;
                    return (
                      <td
                        key={ci}
                        style={{
                          padding: "7px 16px",
                          fontSize: 12,
                          color: isNull ? "rgba(255,255,255,0.2)" : isNegative ? "#f87171" : isNum ? "#a5f3fc" : "rgba(255,255,255,0.82)",
                          fontStyle: isNull ? "italic" : "normal",
                          fontFamily: isNum ? "var(--font-geist-mono, monospace)" : "inherit",
                          whiteSpace: "nowrap",
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                          borderLeft: "1px solid rgba(255,255,255,0.03)",
                          textAlign: isNum ? "right" : "left",
                        }}
                      >
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
      {data.length > 50 && (
        <Box style={{ padding: "8px 16px", borderTop: "1px solid rgba(147,51,234,0.1)", background: "rgba(19,16,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Box style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(147,51,234,0.5)" }} />
          <Text size="11px" c="dimmed">Showing 50 of {data.length.toLocaleString()} rows — export for full dataset</Text>
          <Box style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(147,51,234,0.5)" }} />
        </Box>
      )}
    </Box>
  );
}

function renderToolPart(part: any, i: number) {
  // AI SDK v6 part types for tools vary by agent vs streamText
  // Handle: tool-invocation, tool-call, tool-result, and raw type strings
  const type: string = part.type ?? "";

  // Pending states
  if (
    type === "tool-call" ||
    (type === "tool-invocation" && (part.toolInvocation?.state === "call" || part.toolInvocation?.state === "partial-call")) ||
    type.startsWith("tool-input")
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

  // Result states
  let result: any = null;

  if (type === "tool-result") {
    result = part.result;
  } else if (type === "tool-invocation" && part.toolInvocation?.state === "result") {
    result = part.toolInvocation.result;
  } else if (type === "tool-output-available") {
    result = part.output;
  }

  if (!result) return null;

  if (result.success === false) {
    return (
      <Box key={i} ml="3rem" mt="xs">
        <Text size="xs" c="red.4">SQL Error: {result.error}</Text>
      </Box>
    );
  }

  if (result.success && result.data?.length > 0) {
    return (
      <Box key={i} ml="3rem" mt="sm">
        <DataTable data={result.data} />
      </Box>
    );
  }

  if (result.success && result.data?.length === 0) {
    return (
      <Box key={i} ml="3rem" mt="xs">
        <Text size="xs" c="dimmed">Query returned no rows.</Text>
      </Box>
    );
  }

  return null;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  return (
    <>
      {messages.map((m) => (
        <Stack key={m.id} gap="sm">
          <Group gap="md" align="flex-start" wrap="nowrap">
            <Avatar
              size="md"
              radius="xl"
              color={m.role === "user" ? "blue" : "violet"}
              style={{ background: m.role === "user" ? "rgba(37,99,235,0.1)" : "transparent", flexShrink: 0 }}
            >
              {m.role === "user"
                ? <IconUser size={20} />
                : <IconSparkles size={24} style={{ color: "#a855f7" }} />}
            </Avatar>
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={700} size="sm" c="white">{m.role === "user" ? "You" : "Orcha Agent"}</Text>
              {m.parts.map((part: any, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <Text key={i} size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {part.text}
                    </Text>
                  );
                }
                return null;
              })}
            </Stack>
          </Group>

          {/* Tool parts rendered outside the bubble */}
          {m.parts.map((part: any, i) => renderToolPart(part, i))}
        </Stack>
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
    </>
  );
}
