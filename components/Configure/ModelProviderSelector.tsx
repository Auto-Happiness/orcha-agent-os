import { 
  Group, 
  Stack, 
  Text, 
  UnstyledButton, 
  rem, 
  ScrollArea,
  Box,
  ThemeIcon
} from "@mantine/core";
import { 
  IconBrandGoogle, 
  IconBrandOpenai, 
  IconBrain, 
  IconBolt, 
  IconSparkles,
  IconLetterA,
  IconRobot,
  IconChevronRight,
  IconActivity
} from "@tabler/icons-react";

const PROVIDERS = [
  { id: "google",    label: "Google Vertex AI", icon: IconBrandGoogle, color: "blue" },
  { id: "openai",    label: "OpenAI",           icon: IconBrandOpenai, color: "green" },
  { id: "anthropic", label: "Anthropic Claude", icon: IconBrain,       color: "gray" },
  { id: "mistral",   label: "Mistral AI",       icon: IconBolt,        color: "orange" },
  { id: "meta",      label: "Meta Llama",       icon: IconLetterA,     color: "blue" },
  { id: "xai",       label: "X.AI (Grok)",      icon: IconSparkles,    color: "gray" },
  { id: "deepseek",  label: "DeepSeek",         icon: IconActivity,    color: "blue" },
  { id: "qwen",      label: "Alibaba Qwen",     icon: IconSparkles,    color: "orange" },
  { id: "groq",      label: "Groq (LPU)",       icon: IconBolt,        color: "yellow" },
  { id: "ollama",    label: "Local Ollama",     icon: IconRobot,       color: "gray" },
];

interface ProviderSelectorProps {
  selected: string;
  onSelect: (provider: string) => void;
}

export function ModelProviderSelector({ selected, onSelect }: ProviderSelectorProps) {
  return (
    <Box h="100%" display="flex" style={{ flexDirection: "column" }}>
      <Text size="xs" fw={700} c="dimmed" mb={16} ml={4} style={{ textTransform: "uppercase", letterSpacing: rem(1.5) }}>
        Select model engine
      </Text>
      
      <ScrollArea style={{ flex: 1 }} scrollbars="y" offsetScrollbars>
        <Stack gap="xs" pr="sm">
          {PROVIDERS.map((p) => (
            <UnstyledButton
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                width: "100%",
                padding: `${rem(12)} ${rem(16)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: selected === p.id ? "rgba(147,51,234,0.12)" : "transparent",
                border: "1px solid",
                borderColor: selected === p.id ? "rgba(147,51,234,0.3)" : "transparent",
                borderRadius: rem(10),
                transition: "all 150ms ease",
                "&:hover": {
                  background: "rgba(147,51,234,0.06)",
                }
              }}
            >
              <Group gap="md">
                <ThemeIcon 
                  variant="light" 
                  color={selected === p.id ? "violet" : "gray"} 
                  size="md" 
                  radius="md"
                  style={{ 
                    background: selected === p.id ? "rgba(147,51,234,0.2)" : "rgba(255,255,255,0.04)" 
                  }}
                >
                  <p.icon size={18} style={{ color: selected === p.id ? "#c084fc" : "rgba(255,255,255,0.3)" }} />
                </ThemeIcon>
                <Text size="sm" fw={selected === p.id ? 700 : 500} c={selected === p.id ? "white" : "dimmed"} style={{ whiteSpace: "nowrap" }}>
                  {p.label}
                </Text>
              </Group>

              {selected === p.id && <IconChevronRight size={14} color="#9333ea" />}
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
