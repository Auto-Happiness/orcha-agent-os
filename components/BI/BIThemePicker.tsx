"use client";

import React from "react";
import { Group, ColorInput, Text, Stack, UnstyledButton, Tooltip, Box, Divider } from "@mantine/core";
import { IconPalette, IconColorPicker } from "@tabler/icons-react";

const PREDEFINED_PALETTES = [
  { name: "Orcha", colors: ["#9333ea", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff"] },
  { name: "Neon", colors: ["#00D1FF", "#00FF94", "#FF00E5", "#FFB800", "#7000FF"] },
  { name: "Ocean", colors: ["#0077b6", "#00b4d8", "#90e0ef", "#caf0f8", "#03045e"] },
  { name: "Sunset", colors: ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#F473B9"] },
];

interface BIThemePickerProps {
  primaryColor: string;
  onColorChange: (color: string) => void;
  onPaletteChange: (colors: string[]) => void;
  selectedPaletteName?: string;
}

export function BIThemePicker({
  primaryColor,
  onColorChange,
  onPaletteChange,
  selectedPaletteName
}: BIThemePickerProps) {
  return (
    <Stack gap="md">
      <Box>
        <Group gap="xs" mb="xs">
          <IconPalette size={14} color="gray" />
          <Text size="xs" fw={700} c="dimmed">CHART PALETTES</Text>
        </Group>
        <Group gap="xs">
          {PREDEFINED_PALETTES.map((p) => (
            <Tooltip key={p.name} label={p.name} withArrow>
              <UnstyledButton
                onClick={() => {
                  onPaletteChange(p.colors);
                  onColorChange(p.colors[0]);
                }}
                style={{
                  padding: "4px",
                  borderRadius: "8px",
                  background: selectedPaletteName === p.name ? "rgba(147, 51, 234, 0.1)" : "transparent",
                  border: `1px solid ${selectedPaletteName === p.name ? "rgba(147, 51, 234, 0.3)" : "transparent"}`,
                  transition: "all 0.2s ease"
                }}
              >
                <Group gap={2}>
                  {p.colors.slice(0, 3).map((c, i) => (
                    <Box
                      key={i}
                      w={12}
                      h={12}
                      style={{ borderRadius: "50%", background: c }}
                    />
                  ))}
                </Group>
              </UnstyledButton>
            </Tooltip>
          ))}
        </Group>
      </Box>

      <Divider variant="dashed" color="rgba(255,255,255,0.05)" />

      <Box>
        <Group gap="xs" mb="xs">
          <IconColorPicker size={14} color="gray" />
          <Text size="xs" fw={700} c="dimmed">CUSTOM PRIMARY COLOR</Text>
        </Group>
        <ColorInput
          value={primaryColor}
          onChange={onColorChange}
          placeholder="Pick a color"
          size="xs"
          withEyeDropper
          styles={{
            input: {
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "white",
            },
            eyeDropperButton: {
               color: "white"
            }
          }}
        />
      </Box>
    </Stack>
  );
}
