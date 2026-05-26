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
      rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
      styles={{
        input: { color: "rgba(255,255,255,0.6)", fontSize: "11px" },
        dropdown: { background: "#0c0a1a", borderColor: "rgba(147, 51, 234, 0.2)" },
        groupLabel: { color: "#a855f7", fontWeight: 700, fontSize: "9px" },
        option: { fontSize: "11px", color: "white" },
      }}
    />
  );
}
