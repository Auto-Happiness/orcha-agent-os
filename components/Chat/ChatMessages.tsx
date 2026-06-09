"use client";

import { Stack, Group, Avatar, Text, Box, Loader, Tooltip as MantineTooltip, Button } from "@mantine/core";
import { IconUser, IconSparkles, IconDatabase, IconCode, IconCheck, IconBrain, IconPlugConnected } from "@tabler/icons-react";
import { UIMessage } from "ai";
import React, { useCallback, useState, memo } from "react";

// Sub-components & Helpers
import { ChatImagePreview, isImageUrl } from "./TableCellImage";
import { DataTable } from "./DataTable";
import { ChartBlock } from "./ChartBlock";
import { SQLModal } from "./SQLModal";
import { McpToolModal, McpToolCall } from "./McpToolModal";
import { ReasoningBlock } from "./ReasoningBlock";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  showResults: boolean;
  organizationId?: string;
  configId?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────


function parseMarkdown(text: string, stripTables?: boolean): React.ReactNode[] {
  // Pre-filter: Remove massive data URIs that Gemini sometimes generates despite prompt instructions
  text = text.replace(/!?\[[^\]]*\]\(data:image\/[^)]+\)/g, "[Chart visualization hidden]");
  text = text.replace(/\(?data:image\/[^\s)]+\)?/g, "[Chart visualization hidden]");

  // Strip markdown tables to prevent duplicate/cluttered rendering in chat
  if (stripTables) {
    const markdownTableRegex = /((?:^|\n)[ \t]*\|[^\n]*\|[^\n]*\n[ \t]*\|[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|[^\n]*(?:\n[ \t]*\|[^\n]*\|[^\n]*)*)/g;
    text = text.replace(markdownTableRegex, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Match bold (**text**), italic (*text*), code (`text`), and links [text](url) or images ![text](url)
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(!)?\[(.+?)\]\((.+?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the matched element
    if (match[1]) {
      // Bold
      parts.push(
        <Text key={`bold-${match.index}`} component="span" fw={700} c="inherit">
          {match[1]}
        </Text>
      );
    } else if (match[2]) {
      // Italic
      parts.push(
        <Text key={`italic-${match.index}`} component="span" style={{ fontStyle: "italic" }} c="inherit">
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Code
      parts.push(
        <Text
          key={`code-${match.index}`}
          component="span"
          size="xs"
          style={{
            background: "rgba(147,51,234,0.15)",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "monospace",
          }}
          c="violet.2"
        >
          {match[3]}
        </Text>
      );
    } else if (match[5] && match[6]) {
      // Link or Image
      const hasExclamation = !!match[4];
      const linkText = match[5];
      const linkUrl = match[6];
      const isImg = hasExclamation || isImageUrl(linkUrl);

      if (isImg) {
        parts.push(
          <ChatImagePreview key={`img-${match.index}`} url={linkUrl} alt={linkText} />
        );
      } else {
        parts.push(
          <Text
            key={`link-${match.index}`}
            component="a"
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            c="violet.3"
            style={{ textDecoration: "underline", cursor: "pointer" }}
          >
            {linkText}
          </Text>
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function extractSQLFromParts(parts: any[]): string[] {
  const queries: string[] = [];
  for (const part of parts) {
    const type: string = part.type ?? "";
    let sql: string | undefined;
    if (type === "tool-execute_sql" || type === "tool-execute_federated_sql") sql = part.input?.sql;
    else if (type === "tool-invocation" && (part.toolInvocation?.toolName === "execute_sql" || part.toolInvocation?.toolName === "execute_federated_sql"))
      sql = (part.toolInvocation.input as any)?.sql ?? (part.toolInvocation.args as any)?.sql;
    else if (type === "tool-result" && (part.toolName === "execute_sql" || part.toolName === "execute_federated_sql"))
      sql = (part.input as any)?.sql ?? (part.args as any)?.sql;
    
    if (sql && !queries.includes(sql)) queries.push(sql);
  }
  return queries;
}

function hasSuccessfulSQLResult(parts: any[]): boolean {
  if (!parts) return false;
  return parts.some((part) => {
    const type = part.type ?? "";
    let toolName = part.toolInvocation?.toolName || part.toolName || "query";
    if (type === "tool-execute_sql" || type === "tool-execute_federated_sql") {
      toolName = type === "tool-execute_sql" ? "execute_sql" : "execute_federated_sql";
    } else if (type === "tool-output-available") {
      toolName = part.toolName || "tool";
    }

    const isSQL = toolName === "execute_sql" || toolName === "execute_federated_sql";
    if (!isSQL) return false;

    let result: any = null;
    if ((type === "tool-execute_sql" || type === "tool-execute_federated_sql") && part.state === "output-available") {
      result = part.output;
    } else if (type === "tool-result") {
      result = part.result;
    } else if (type === "tool-invocation" && part.toolInvocation?.state === "result") {
      result = part.toolInvocation.result;
    } else if (type === "tool-output-available") {
      result = part.output;
    }

    return result && result.success !== false && !result.error && result.data?.length > 0;
  });
}

function extractMcpToolsFromParts(parts: any[]): McpToolCall[] {
  const calls: McpToolCall[] = [];
  const NATIVE_TOOLS = ["search_db_schema", "dry_plan_sql", "execute_sql", "execute_federated_sql"];

  if (!parts) return [];

  for (const part of parts) {
    const type: string = part.type ?? "";
    let toolName: string | undefined;
    let args: any;
    let result: any;

    if (type === "tool-invocation") {
      toolName = part.toolInvocation?.toolName;
      args = part.toolInvocation?.args ?? part.toolInvocation?.input;
      result = part.toolInvocation?.result;
    } else if (type === "tool-result") {
      toolName = part.toolName;
      args = part.args ?? part.input;
      result = part.result;
    } else if (type === "tool-output-available") {
      toolName = part.toolName;
      args = part.args ?? part.input;
      result = part.output;
    } else if (type.startsWith("tool-") && !type.includes("execute_sql") && !type.includes("execute_federated_sql")) {
      toolName = type.replace("tool-", "");
      args = part.input ?? part.args;
      result = part.output ?? part.result;
    }

    if (toolName && !NATIVE_TOOLS.includes(toolName)) {
      const alreadyExists = calls.some(
        c => c.name === toolName && JSON.stringify(c.args) === JSON.stringify(args)
      );
      if (!alreadyExists) {
        calls.push({
          name: toolName,
          args,
          result
        });
      }
    }
  }

  return calls;
}

function renderToolPart(
  part: any,
  i: number,
  showResults: boolean,
  organizationId?: string,
  configId?: string | null,
  messageId?: string,
  parts?: any[]
) {
  const type: string = part.type ?? "";

  // Resolve toolName early to check if it should be hidden from UI
  let toolName = part.toolInvocation?.toolName || part.toolName || "query";
  if (type === "tool-execute_sql" || type === "tool-execute_federated_sql") {
    toolName = type === "tool-execute_sql" ? "execute_sql" : "execute_federated_sql";
  } else if (type === "tool-output-available") {
    toolName = part.toolName || "tool";
  }

  // Hide internal schema searches and dry-runs from cluttering the user interface
  if (toolName === "search_db_schema" || toolName === "dry_plan_sql") return null;

  if (
    type === "tool-call" ||
    (type === "tool-invocation" && (part.toolInvocation?.state === "call" || part.toolInvocation?.state === "partial-call")) ||
    type.startsWith("tool-input") ||
    (type === "tool-execute_sql" && part.state === "input-streaming")
  ) {
    const isSQL = toolName === "execute_sql" || toolName === "execute_federated_sql";
    
    return (
      <Box key={i} ml="3rem" mt="xs">
        <Group gap={6}>
          {isSQL ? <IconDatabase size={13} color="#a855f7" /> : <IconSparkles size={13} color="#a855f7" />}
          <Loader size="xs" color="violet" type="dots" />
          <Text size="xs" c="dimmed">{isSQL ? "Running query..." : `Performing ${toolName.replace(/_/g, ' ')}...`}</Text>
        </Group>
      </Box>
    );
  }

  let result: any = null;

  if ((type === "tool-execute_sql" || type === "tool-execute_federated_sql") && part.state === "output-available") {
    result = part.output;
  }
  else if (type === "tool-result") {
    result = part.result;
  }
  else if (type === "tool-invocation" && part.toolInvocation?.state === "result") {
    result = part.toolInvocation.result;
  }
  else if (type === "tool-output-available") {
    result = part.output;
  }

  if (!result) return null;

  if (result.success === false || result.error) {
    return <Box key={i} ml="3rem" mt="xs"><Text size="xs" c="red.4">Error: {result.error || result.message || "Action failed"}</Text></Box>;
  }

  const isSQL = toolName === "execute_sql" || toolName === "execute_federated_sql";
  const partSql = isSQL 
    ? (part.input?.sql ?? part.toolInvocation?.args?.sql ?? part.args?.sql) 
    : undefined;

  // Render chart
  const isChart = isSQL && result.chartConfig != null;
  if (isChart && result.success && result.data?.length > 0) {
    const config = result.chartConfig;
    return (
      <Box key={i} ml="3rem" mt="sm">
        <ChartBlock
          chartType={config.chartType}
          title={config.title}
          xKey={config.xKey}
          yKeys={[config.yKey]}
          data={result.data}
          initialColors={config.seriesColors}
          messageId={messageId}
          parts={parts}
          partIndex={i}
        />
      </Box>
    );
  }

  // Render SQL Tables
  if (isSQL && result.data?.length > 0) {
    if (!showResults) return null;
    return (
      <Box key={i} ml="3rem" mt="sm">
        <DataTable data={result.data} sql={partSql} organizationId={organizationId} configId={configId} />
      </Box>
    );
  }

  if (isSQL && result.data?.length === 0) {
    return <Box key={i} ml="3rem" mt="xs"><Text size="xs" c="dimmed">Query returned no rows.</Text></Box>;
  }

  // Render Generic Tool Results (MCP)
  return (
    <Box key={i} ml="3rem" mt="xs">
      <Group gap={6}>
        <IconCheck size={12} color="var(--mantine-color-green-4)" />
        <Text size="xs" fw={600} c="green.3">
          Completed {toolName.replace(/_/g, ' ')}
        </Text>
      </Group>
      {result.content && typeof result.content === 'string' && (
        <Box mt={4} p="6px 12px" style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid rgba(147,51,234,0.1)" }}>
          <Text size="xs" c="dimmed">{result.content}</Text>
        </Box>
      )}
    </Box>
  );
}

// ── MessageRow (memoized ── only re-renders when its own message changes) ─────

const MessageRow = memo(function MessageRow({ m, showResults, organizationId, configId, onViewSql, onViewMcpTools }: {
  m: any; showResults: boolean; organizationId?: string; configId?: string | null; onViewSql: (q: string[]) => void; onViewMcpTools: (calls: McpToolCall[]) => void;
}) {
  const sqlQueries = m.role === "assistant" ? extractSQLFromParts(m.parts as any[]) : [];
  const mcpToolCalls = m.role === "assistant" ? extractMcpToolsFromParts(m.parts as any[]) : [];
  const hasSqlResult = showResults && hasSuccessfulSQLResult(m.parts || []);
  const hasButtons = sqlQueries.length > 0 || mcpToolCalls.length > 0;

  // Pass parsing logic wrapper to avoid circular reference in ReasoningBlock
  const renderMarkdown = useCallback((content: string) => {
    return parseMarkdown(content);
  }, []);

  return (
    <Stack gap="sm">
      <Group gap="md" align="flex-start" wrap="nowrap">
        <Avatar size="md" radius="xl" color={m.role === "user" ? "blue" : "violet"} style={{ background: m.role === "user" ? "rgba(37,99,235,0.1)" : "transparent", flexShrink: 0 }}>
          {m.role === "user" ? <IconUser size={20} /> : <IconSparkles size={24} style={{ color: "#a855f7" }} />}
        </Avatar>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" c="white">{m.role === "user" ? "You" : "Orcha Agent"}</Text>
          {m.parts.map((part: any, i: number) => {
            if (part.type !== "text" || !part.text) return null;

            const MARKER = "### \uD83E\uDDE0 Reasoning";
            const markerIdx = part.text.indexOf(MARKER);

            // Combined Reasoning Split Logic
            // Combined Reasoning Split Logic
            if (markerIdx !== -1) {
              const before = part.text.slice(0, markerIdx).trim();
              const reasoningAndAfter = part.text.slice(markerIdx);
              const afterMarker = reasoningAndAfter.slice(MARKER.length).trimStart();
              
              // Smart split: Group reasoning paragraphs until we hit one that doesn't look like reasoning
              const sections = afterMarker.split(/\n{2,}/);
              let reasoningEndIndex = 0;
              
              for (let j = 1; j < sections.length; j++) {
                const s = sections[j].trimStart();
                const lowerS = s.toLowerCase();
                // If it starts with a common answer transition or doesn't look like a bullet/bold header, we break
                if (lowerS.startsWith("final") || lowerS.startsWith("based on") || lowerS.startsWith("here") || lowerS.startsWith("the ") || (!s.startsWith("*") && !s.startsWith("-") && !s.startsWith("#") && !/^\d+\./.test(s))) {
                  break;
                }
                reasoningEndIndex = j;
              }
              
              const reasoningContent = sections.slice(0, reasoningEndIndex + 1).join("\n\n").trim();
              const afterAnswer = sections.slice(reasoningEndIndex + 1).join("\n\n").trim();

              return (
                <React.Fragment key={i}>
                  {before ? <Text size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12 }} component="div">{parseMarkdown(before, hasSqlResult)}</Text> : null}
                  <ReasoningBlock text={MARKER + "\n" + reasoningContent} renderMarkdown={renderMarkdown} />
                  {afterAnswer ? <Text size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 4 }} component="div">{parseMarkdown(afterAnswer, hasSqlResult)}</Text> : null}
                </React.Fragment>
              );
            }

            // Plain text part — no reasoning marker
            return (
              <Text key={i} size="sm" c="rgba(255,255,255,0.88)" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }} component="div">
                {parseMarkdown(part.text, hasSqlResult)}
              </Text>
            );
          })}
          {hasButtons && (
            <Group gap="xs" mt={6}>
              {sqlQueries.length > 0 && (
                <Button size="compact-xs" variant="subtle" color="violet" radius="md" leftSection={<IconCode size={11} />} onClick={() => onViewSql(sqlQueries)} styles={{ root: { fontSize: 11, opacity: 0.6 } }}>
                  View SQL
                </Button>
              )}
              {mcpToolCalls.length > 0 && (
                <Button size="compact-xs" variant="subtle" color="violet" radius="md" leftSection={<IconPlugConnected size={11} />} onClick={() => onViewMcpTools(mcpToolCalls)} styles={{ root: { fontSize: 11, opacity: 0.6 } }}>
                  MCP Tool
                </Button>
              )}
              <MantineTooltip label="Estimated tokens used for this turn (prompt + response)" position="top" withArrow>
                <Box style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(147,51,234,0.1)", border: "1px solid rgba(147,51,234,0.2)", cursor: "help" }}>
                  <Group gap={4}>
                    <IconBrain size={10} color="rgba(192,132,252,0.8)" />
                    <Text size="10px" fw={600} c="violet.3">
                      ~{Math.ceil(JSON.stringify(m.parts).length / 4) + 850} tokens spent
                    </Text>
                  </Group>
                </Box>
              </MantineTooltip>
            </Group>
          )}
        </Stack>
      </Group>
      {(m.parts as any[]).map((part: any, i: number) => renderToolPart(part, i, showResults, organizationId, configId, m.id || m._id, m.parts))}
    </Stack>
  );
});

// ── ChatMessages ─────────────────────────────────────────────────────────────

export function ChatMessages({ messages, isLoading, showResults, organizationId, configId }: ChatMessagesProps) {
  const [sqlModal, setSqlModal] = useState<string[] | null>(null);
  const [mcpModal, setMcpModal] = useState<McpToolCall[] | null>(null);

  return (
    <>
      {messages.map((m) => (
        <MessageRow key={m.id} m={m} showResults={showResults} organizationId={organizationId} configId={configId} onViewSql={setSqlModal} onViewMcpTools={setMcpModal} />
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
      <McpToolModal calls={mcpModal ?? []} opened={mcpModal !== null} onClose={() => setMcpModal(null)} />
    </>
  );
}
