"use client";

import { ActionIcon, useMantineColorScheme } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";

  return (
    <ActionIcon
      variant="subtle"
      color="violet"
      onClick={() => setColorScheme(dark ? "light" : "dark")}
      title="Toggle color scheme"
      size="lg"
      style={{
        color: "var(--orcha-text-muted)",
      }}
    >
      {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}
