"use client";

import { useState, useEffect } from "react";
import { ActionIcon, useMantineColorScheme } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = colorScheme === "dark";

  // During server rendering (SSR) or before mounting, default to the dark scheme icon (IconSun)
  // to match the defaultColorScheme="dark" set on ColorSchemeScript.
  if (!mounted) {
    return (
      <ActionIcon
        variant="subtle"
        color="violet"
        title="Toggle color scheme"
        size="lg"
        style={{
          color: "var(--orcha-text-muted)",
        }}
      >
        <IconSun size={18} />
      </ActionIcon>
    );
  }

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
