"use client";

import React from "react";
import { Box, Group, Text, TextInput } from "@mantine/core";

interface FormulaBarProps {
  activeCell: string | null;
  value: string;
  onChange: (val: string) => void;
}

export function FormulaBar({ activeCell, value, onChange }: FormulaBarProps) {
  return (
    <Group gap={0} px="md" py={4} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <Box px="sm" py={2} style={{ borderRight: "1px solid rgba(255,255,255,0.08)", minWidth: 60 }}>
        <Text fw={700} c="green.4" size="xs" ta="center">{activeCell || ""}</Text>
      </Box>
      <TextInput 
        variant="unstyled" 
        placeholder="Enter formula or data marker..." 
        size="xs"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        styles={{ input: { paddingLeft: "10px", color: "white", fontSize: "13px" } }}
        style={{ flex: 1 }}
      />
    </Group>
  );
}
