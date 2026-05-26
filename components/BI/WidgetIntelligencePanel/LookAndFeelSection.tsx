import React from "react";
import { Box, Group, Text, Paper, Stack, ColorInput } from "@mantine/core";
import { IconPalette } from "@tabler/icons-react";

interface LookAndFeelSectionProps {
  widgetType: string;
  colorKeys: string[];
  seriesColors: Record<string, string>;
  onChangeSeriesColors: (colors: Record<string, string>) => void;
}

export function LookAndFeelSection({
  widgetType,
  colorKeys,
  seriesColors,
  onChangeSeriesColors,
}: LookAndFeelSectionProps) {
  if (widgetType === "table") return null;

  const handleColorChange = (key: string, color: string) => {
    onChangeSeriesColors({
      ...seriesColors,
      [key]: color,
    });
  };

  return (
    <Box mt="md">
      <Group gap="xs" mb="xs">
        <IconPalette size={16} color="gray" />
        <Text size="sm" fw={600} c="dimmed">
          5. LOOK & FEEL
        </Text>
      </Group>
      <Paper p="md" radius="md" style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.05)" }}>
        {colorKeys.length > 0 ? (
          <Stack gap={8}>
            {colorKeys.map((key) => (
              <Group key={key} justify="space-between">
                <Text size="xs" c="dimmed">
                  {key}
                </Text>
                <ColorInput
                  size="xs"
                  w={120}
                  value={seriesColors[key] || "#9333ea"}
                  onChange={(color) => handleColorChange(key, color)}
                  popoverProps={{ withinPortal: true, zIndex: 10000 }}
                />
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" ta="center">
            Select value columns to configure colors
          </Text>
        )}
      </Paper>
    </Box>
  );
}
