"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ReactNode } from "react";

// Import Mantine base CSS (required)
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const theme = createTheme({
  fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
  fontFamilyMonospace: "var(--font-geist-mono), monospace",
  primaryColor: "violet",
  primaryShade: { light: 6, dark: 7 },
  colors: {
    // Orcha purple scale — maps to Mantine's "violet" slot
    violet: [
      "#f5f0ff", // 0
      "#e9d8ff", // 1
      "#d4b0ff", // 2
      "#bc84fc", // 3 — orcha-violet
      "#a855f7", // 4
      "#9333ea", // 5 — orcha-purple (primary)
      "#7c3aed", // 6
      "#6d28d9", // 7
      "#5b21b6", // 8
      "#4c1d95", // 9
    ],
  },
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    NavLink: {
      defaultProps: {
        radius: "md",
      },
    },
    Select: {
      styles: {
        dropdown: { background: "var(--orcha-panel)", borderColor: "var(--orcha-border)", color: "var(--foreground)" },
        option: {
          backgroundColor: "transparent",
        }
      }
    },
    TextInput: {
      styles: {
        input: {
          borderColor: "var(--orcha-border)",
          background: "var(--orcha-surface)",
          color: "var(--foreground)",
        }
      }
    },
    PasswordInput: {
      styles: {
        input: {
          borderColor: "var(--orcha-border)",
          background: "var(--orcha-surface)",
          color: "var(--foreground)",
        }
      }
    }
  },
});

export function MantineUiProvider({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" zIndex={1000} />
      {children}
    </MantineProvider>
  );
}
