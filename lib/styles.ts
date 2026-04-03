import { TextInput, PasswordInput, Select, Box } from "@mantine/core";

export const inputStyles = {
  label: { color: "rgba(255,255,255,0.7)", marginBottom: "6px", fontSize: "13px" },
  input: { 
    background: "rgba(255,255,255,0.04)", 
    borderColor: "rgba(255,255,255,0.12)", 
    color: "white",
    "&:focus": { borderColor: "#9333ea" }
  },
  innerInput: { color: "white" }
};

export const selectStyles = {
  label: { color: "rgba(255,255,255,0.7)", marginBottom: "6px", fontSize: "13px" },
  input: { 
    background: "rgba(255,255,255,0.04)", 
    borderColor: "rgba(255,255,255,0.12)", 
    color: "white" 
  },
  dropdown: { background: "#130f22", borderColor: "rgba(147,51,234,0.18)", color: "white" },
};
