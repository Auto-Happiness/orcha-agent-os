"use client";

import React from "react";
import { Box, UnstyledButton, Collapse, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconBrain, IconChevronUp, IconChevronDown } from "@tabler/icons-react";

export function ReasoningBlock({
  text,
  renderMarkdown,
}: {
  text: string;
  renderMarkdown: (t: string) => React.ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure(true);
  // Bug fix: use a loose split instead of a strict regex so minor LLM formatting
  // variations (extra spaces, missing newline) don't break the strip.
  const reasoningMarker = "### \uD83E\uDDE0 Reasoning";
  const markerIndex = text.indexOf(reasoningMarker);
  const content = markerIndex >= 0
    ? text.slice(markerIndex + reasoningMarker.length).trimStart()
    : text;

  return (
    <Box 
      style={{ 
        background: "transparent", 
        border: "none",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 16
      }}
    >
      <UnstyledButton 
        onClick={toggle}
        p="xs"
        px="sm"
        w="100%"
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 10,
          background: "transparent"
        }}
      >
        <IconBrain size={15} color="#a855f7" />
        <Text fw={600} c="var(--orcha-purple)" style={{ flex: 1, fontSize: 10.5, letterSpacing: "0.01em" }}>Reasoning Process</Text>
        {opened ? <IconChevronUp size={14} opacity={0.5} /> : <IconChevronDown size={14} opacity={0.5} />}
      </UnstyledButton>
      
      <Collapse expanded={opened}>
        <Box p="xs" px="sm" pb="sm">
          <Text size="xs" c="var(--orcha-text-muted)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }} component="div">
            {renderMarkdown(content)}
          </Text>
        </Box>
      </Collapse>
    </Box>
  );
}
