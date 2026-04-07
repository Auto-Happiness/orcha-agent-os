import { 
  Box, 
  Paper, 
  Stack, 
  TextInput, 
  Group, 
  ActionIcon, 
  Select, 
  Badge, 
  Transition,
  Text,
  Avatar
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { 
  IconPlus, 
  IconAdjustmentsHorizontal, 
  IconChevronDown, 
  IconMicrophone, 
  IconArrowRight,
  IconSparkles
} from "@tabler/icons-react";

interface ChatPromptBoxProps {
  input: string;
  handleInputChange: (e: any) => void;
  handleSubmit: (e: any) => void;
  isLoading: boolean;
  allConfigs: any[];
  selectedConfigId: string | null;
  setSelectedConfigId: (val: string | null) => void;
  aiKeys: any[];
  selectedModel: string;
  setSelectedModel: (val: string) => void;
}

const MODEL_OPTIONS = [
  {
    group: "OpenAI",
    items: [
      { value: "openai:gpt-4o", label: "GPT-4o" },
      { value: "openai:gpt-4o-mini", label: "GPT-4o mini" },
      { value: "openai:gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
  {
    group: "Google Gemini",
    items: [
      { value: "gemini:gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini:gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini:gemini-1.0-pro", label: "Gemini 1.0 Pro" },
    ],
  },
  {
    group: "Anthropic Claude",
    items: [
      { value: "claude:claude-3-5-sonnet-20240620", label: "Claude 3.5 Sonnet" },
      { value: "claude:claude-3-opus-20240229", label: "Claude 3 Opus" },
    ],
  },
  {
    group: "Local & Grok",
    items: [
      { value: "grok:grok-1", label: "Grok-1" },
      { value: "local:llama-3.1", label: "Llama 3.1 (Local)" },
      { value: "local:mistral", label: "Mistral (Local)" },
    ],
  }
];

export function ChatPromptBox({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  allConfigs,
  selectedConfigId,
  setSelectedConfigId,
  aiKeys,
  selectedModel,
  setSelectedModel
}: ChatPromptBoxProps) {

  const handleModelChange = (val: string | null) => {
    if (!val) return;
    const provider = val.split(":")[0];
    
    // Check if key exists for this provider
    const hasKey = aiKeys?.some(k => k.provider === provider);
    
    if (!hasKey && provider !== "local") {
      notifications.show({ 
        title: "Configuration Error", 
        message: "API key not configured for this provider in Settings.", 
        color: "red" 
      });
      // Optionally we could return early to prevent selection, but let's allow it 
      // so the user knows what they selected. The backend will also reject it if they try to query.
    }
    setSelectedModel(val);
  };

  return (
    <Box p="md" style={{ background: "transparent" }}>
      <form onSubmit={handleSubmit}>
        <Paper 
          radius="lg" 
          p="sm" 
          style={{ 
            background: "#161616", 
            border: "1px solid rgba(255,255,255,0.1)",
            transition: "all 0.2s ease",
          }}
          onFocusCapture={(e) => e.currentTarget.style.borderColor = "rgba(147,51,234,0.4)"}
          onBlurCapture={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
        >
          <Stack gap="xs">
            <TextInput
              placeholder="Ask anything, @ to mention, / for workflows"
              variant="unstyled"
              size="md"
              value={input}
              onChange={handleInputChange}
              styles={{ 
                input: { 
                  color: "white", 
                  fontSize: "14px",
                  background: "transparent"
                } 
              }}
            />
            
            <Group justify="space-between" align="center">
              <Group gap={8}>
                 <ActionIcon variant="transparent" color="dimmed" size="md">
                    <IconPlus size={18} />
                 </ActionIcon>
                 
                 <Select
                   data={allConfigs?.map(c => ({ value: c._id, label: c.name })) || []}
                   value={selectedConfigId}
                   onChange={setSelectedConfigId}
                   variant="unstyled"
                   size="xs"
                   w={220}
                   comboboxProps={{ position: 'top-start', width: 320, shadow: 'xl' }}
                   leftSection={<IconAdjustmentsHorizontal size={14} color="rgba(255,255,255,0.4)" />}
                   rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                   renderOption={({ option }) => {
                      const config = allConfigs?.find(c => c._id === option.value);
                      return (
                        <Group gap="sm" wrap="nowrap">
                          <Avatar 
                             src={config?.image || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"} 
                             size={24} 
                             radius="xs" 
                             style={{ background: "transparent", opacity: 0.8 }}
                          />
                          <Stack gap={2} style={{ flex: 1 }}>
                             <Text size="xs" fw={700} c="white">{option.label}</Text>
                             {config?.description && (
                               <Text size="10px" c="dimmed" style={{ lineHeight: 1.2 }}>
                                 {config.description}
                               </Text>
                             )}
                          </Stack>
                        </Group>
                      );
                   }}
                   styles={{
                     root: { width: "220px" },
                     input: { 
                       color: "rgba(255,255,255,0.6)", 
                       fontWeight: 500, 
                       fontSize: "12px",
                       background: "transparent", 
                       padding: "0 8px 0 12px"
                     },
                     section: { pointerEvents: "none" },
                     dropdown: { 
                        background: "#161616", 
                        borderColor: "rgba(255,255,255,0.1)", 
                        borderRadius: "8px",
                        padding: "4px"
                     },
                     option: { 
                        fontSize: "12px", 
                        color: "rgba(255,255,255,0.6)", 
                        padding: "8px 12px",
                        borderRadius: "6px",
                        "&[data-selected]": { background: "rgba(147,51,234,0.2)", color: "white" } 
                     }
                   }}
                 />

                 <Select
                   data={MODEL_OPTIONS}
                   value={selectedModel}
                   onChange={handleModelChange}
                   variant="unstyled"
                   size="xs"
                   w={180}
                   comboboxProps={{ position: 'top', width: 220, shadow: 'xl' }}
                   leftSection={<IconSparkles size={14} color="rgba(255,255,255,0.4)" />}
                   rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                   styles={{
                     root: { width: "180px" },
                     input: { 
                       color: "rgba(255,255,255,0.8)", 
                       fontWeight: 500, 
                       fontSize: "12px",
                       background: "transparent", 
                       padding: "0 8px"
                     },
                     dropdown: { 
                        background: "#161616", 
                        borderColor: "rgba(255,255,255,0.1)", 
                        borderRadius: "8px",
                     },
                     groupLabel: {
                        color: "rgba(147,51,234,0.8)",
                        fontWeight: 700,
                        fontSize: "10px",
                        letterSpacing: "1px",
                        padding: "8px 12px 4px 12px"
                     },
                     option: { 
                        fontSize: "12px", 
                        color: "rgba(255,255,255,0.7)", 
                        padding: "6px 12px",
                        "&[data-selected]": { background: "rgba(147,51,234,0.2)", color: "white" } 
                     }
                   }}
                 />
              </Group>

              <Group gap={8}>
                 <ActionIcon variant="transparent" color="dimmed" size="md">
                    <IconMicrophone size={18} />
                 </ActionIcon>
                 
                 <Transition mounted={(input?.length || 0) > 0} transition="scale" duration={200}>
                    {(styles) => (
                      <ActionIcon 
                        style={styles}
                        type="submit" 
                        color="violet" 
                        radius="xl" 
                        size="lg" 
                        variant="filled"
                        disabled={isLoading}
                      >
                        <IconArrowRight size={20} />
                      </ActionIcon>
                    )}
                 </Transition>
              </Group>
            </Group>
          </Stack>
        </Paper>
      </form>
      
      <Text size="10px" ta="center" c="dimmed" py="xs" mt={4} style={{ opacity: 0.5 }}>
        Orcha can make mistakes. Verify important results with the Query Lab.
      </Text>
    </Box>
  );
}
