import { TextInput, PasswordInput, Select, Box } from "@mantine/core";

export const inputStyles = {
  label: { color: "var(--orcha-text-muted)", marginBottom: "6px", fontSize: "13px" },
  input: { 
    background: "var(--orcha-surface)", 
    borderColor: "var(--orcha-border)", 
    color: "var(--foreground)",
    "&:focus": { borderColor: "var(--orcha-purple)" }
  },
  innerInput: { color: "var(--foreground)" }
};

export const selectStyles = {
  label: { color: "var(--orcha-text-muted)", marginBottom: "6px", fontSize: "13px" },
  input: { 
    background: "var(--orcha-surface)", 
    borderColor: "var(--orcha-border)", 
    color: "var(--foreground)" 
  },
  dropdown: { background: "var(--orcha-panel)", borderColor: "var(--orcha-border)", color: "var(--foreground)" },
};
