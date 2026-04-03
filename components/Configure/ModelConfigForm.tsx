import { 
  Stack, 
  Group, 
  Text, 
  Button, 
  Divider,
  Box,
  Badge,
} from "@mantine/core";
import { IconSparkles, IconShieldCheck, IconSettings2 } from "@tabler/icons-react";

// Individual Model Form Components
import { GoogleVertexForm } from "./ModelForms/GoogleVertex";
import { OpenAIForm } from "./ModelForms/OpenAI";
import { AnthropicForm } from "./ModelForms/Anthropic";
import { OllamaForm } from "./ModelForms/Ollama";
import { QwenForm } from "./ModelForms/Qwen";

interface ModelFormProps {
  provider: string;
}

export function ModelConfigForm({ provider }: ModelFormProps) {
  const { data, updateData, setStep } = useCreationWizard();
  const [saving, setSaving] = useState(false);

  const handleSaveModel = async () => {
    setSaving(true);
    // Simulating a brief save delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    updateData({ modelProvider: provider });
    
    notifications.show({
      title: "Model Configured",
      message: `The ${provider.toUpperCase()} engine has been paired with this environment.`,
      color: "violet",
      icon: <IconShieldCheck size={16} />,
    });
    
    setStep(2); // Move to Metadata step
    setSaving(false);
  };

  return (
    <Stack gap="xl">
      <Stack gap={10}>
        <Group gap="xs">
          <IconShieldCheck size={18} color="#22c55e" />
          <Text fw={600} size="sm" c="white">Language Model Parameters</Text>
          <Badge variant="dot" color="violet" size="xs">{provider.toUpperCase()}</Badge>
        </Group>
      </Stack>

      {/* Dynamic Form Content */}
      <Box>
        {renderForm()}
      </Box>

      <Box p="md" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "8px" }}>
        <Group gap="xs">
          <IconSettings2 size={16} color="rgba(255,255,255,0.4)" />
          <Text size="xs" fw={700} c="white">Advanced Context Tuning</Text>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          Fine-tune the reasoning tokens and context window limitations for this specific agent engine. 
          Recommended for production-level agents with 1M+ token contexts.
        </Text>
      </Box>

      <Divider style={{ borderColor: "rgba(255,255,255,0.05)" }} />

      <Group justify="flex-end" mt="md">
        <Button variant="light" color="violet" leftSection={<IconSparkles size={16} />}>Test Intelligence</Button>
        <Button 
          color="violet" 
          px="xl" 
          loading={saving}
          onClick={handleSaveModel}
        >
          Save Model Config
        </Button>
      </Group>
    </Stack>
  );
}
