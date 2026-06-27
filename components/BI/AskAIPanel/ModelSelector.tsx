import React from "react";
import { Select } from "@mantine/core";
import { IconSparkles, IconChevronDown } from "@tabler/icons-react";
import { MODEL_OPTIONS } from "@/lib/model-options";

interface ModelSelectorProps {
  selectedModel: string;
  onChangeSelectedModel: (model: string) => void;
}

export function ModelSelector({ selectedModel, onChangeSelectedModel }: ModelSelectorProps) {
  return (
    <Select
      data={MODEL_OPTIONS}
      value={selectedModel}
      onChange={(val) => val && onChangeSelectedModel(val)}
      variant="unstyled"
      size="xs"
      w={160}
      comboboxProps={{ position: "top", width: 200, shadow: "xl" }}
      leftSection={<IconSparkles size={12} color="#a855f7" />}
      rightSection={<IconChevronDown size={10} color="var(--orcha-text-muted)" />}
      styles={{
        input: { color: "var(--orcha-text-body)", fontSize: "11px" },
        dropdown: { background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" },
        groupLabel: { color: "var(--orcha-purple)", fontWeight: 700, fontSize: "9px" },
        option: { fontSize: "11px", color: "var(--orcha-text-title)" },
      }}
    />
  );
}
