"use client";

import React from "react";
import { ScrollArea, Stack, Group, Avatar, Text } from "@mantine/core";
import { IconUser, IconSparkles } from "@tabler/icons-react";
import { ReasoningBlock } from "@/components/Chat/ReasoningBlock";

interface ConversationTranscriptProps {
  chatHistoryRaw?: string;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(!)?\[(.+?)\]\((.+?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<Text key={`bold-${match.index}`} component="span" fw={700} c="inherit">{match[1]}</Text>);
    } else if (match[2]) {
      parts.push(<Text key={`italic-${match.index}`} component="span" style={{ fontStyle: "italic" }} c="inherit">{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={`code-${match.index}`} component="span" size="xs" style={{ background: "var(--orcha-sidebar-hover-bg)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }} c="var(--orcha-purple)">{match[3]}</Text>);
    } else if (match[5] && match[6]) {
      const linkText = match[5];
      const linkUrl = match[6];
      parts.push(<Text key={`link-${match.index}`} component="a" href={linkUrl} target="_blank" rel="noopener noreferrer" c="var(--orcha-purple)" style={{ textDecoration: "underline", cursor: "pointer" }}>{linkText}</Text>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export function ConversationTranscript({ chatHistoryRaw }: ConversationTranscriptProps) {
  const history = chatHistoryRaw ? JSON.parse(chatHistoryRaw) : [];

  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        No conversation transcript saved with this query.
      </Text>
    );
  }

  return (
    <ScrollArea h={380} offsetScrollbars>
      <Stack gap="lg" px="xs" style={{ maxWidth: "1000px" }}>
        {history.map((m: any, idx: number) => {
          const isUser = m.role === "user";
          return (
            <Group key={m.id || idx} gap="md" align="flex-start" wrap="nowrap">
              <Avatar size="sm" radius="xl" color={isUser ? "blue" : "violet"} style={{ background: isUser ? "var(--orcha-sidebar-hover-bg)" : "transparent", flexShrink: 0 }}>
                {isUser ? <IconUser size={16} /> : <IconSparkles size={18} style={{ color: "var(--orcha-purple)" }} />}
              </Avatar>
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={700} size="xs" c="var(--orcha-text-title)">{isUser ? "You" : "Orcha Agent"}</Text>
                {m.parts && Array.isArray(m.parts) ? (
                  m.parts.map((part: any, partIdx: number) => {
                     if (part.type !== "text" || !part.text) return null;
                     const MARKER = "### \uD83E\uDDE0 Reasoning";
                     const markerIdx = part.text.indexOf(MARKER);
                     if (markerIdx !== -1) {
                       const before = part.text.slice(0, markerIdx).trim();
                       const reasoningAndAfter = part.text.slice(markerIdx);
                       const afterMarker = reasoningAndAfter.slice(MARKER.length).trimStart();
                       const sections = afterMarker.split(/\n{2,}/);
                       let reasoningEndIndex = 0;
                       for (let j = 1; j < sections.length; j++) {
                         const s = sections[j].trimStart();
                         const lowerS = s.toLowerCase();
                         if (lowerS.startsWith("final") || lowerS.startsWith("based on") || lowerS.startsWith("here") || lowerS.startsWith("the ") || (!s.startsWith("*") && !s.startsWith("-") && !s.startsWith("#") && !/^\d+\./.test(s))) {
                           break;
                         }
                         reasoningEndIndex = j;
                       }
                       const reasoningContent = sections.slice(0, reasoningEndIndex + 1).join("\n\n").trim();
                       const afterAnswer = sections.slice(reasoningEndIndex + 1).join("\n\n").trim();
                       return (
                         <React.Fragment key={partIdx}>
                           {before ? <Text size="xs" c="var(--orcha-text-body)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }} component="div">{parseMarkdown(before)}</Text> : null}
                           <ReasoningBlock text={MARKER + "\n" + reasoningContent} renderMarkdown={parseMarkdown} />
                           {afterAnswer ? <Text size="xs" c="var(--orcha-text-body)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 4 }} component="div">{parseMarkdown(afterAnswer)}</Text> : null}
                         </React.Fragment>
                       );
                     }
                     return (
                       <Text key={partIdx} size="xs" c="var(--orcha-text-body)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }} component="div">
                         {parseMarkdown(part.text)}
                       </Text>
                     );
                  })
                ) : (
                  <Text size="xs" c="var(--orcha-text-body)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }} component="div">
                    {parseMarkdown(m.content || "")}
                  </Text>
                )}
              </Stack>
            </Group>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}
