import { Grid, Select, PasswordInput, Stack, Text, Slider } from "@mantine/core";
import { inputStyles, selectStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function GoogleVertexForm() {
  const { data, updateData } = useCreationWizard();
  const modelConfig = data.modelConfig || {};

  const handleUpdate = (field: string, value: any) => {
    updateData({
      modelConfig: { ...modelConfig, [field]: value }
    });
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Select
          label="Model Version"
          data={["Gemini 2.0 Flash", "Gemini 1.5 Pro", "Gemini 1.5 Flash"]}
          value={modelConfig.model || "Gemini 1.5 Pro"}
          onChange={(val) => handleUpdate("model", val || "")}
          styles={selectStyles}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed">Temperature</Text>
          <Slider 
            value={modelConfig.temperature !== undefined ? modelConfig.temperature : 0.7} 
            onChange={(val) => handleUpdate("temperature", val)}
            min={0} 
            max={1} 
            step={0.1} 
            color="violet" 
          />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <PasswordInput 
          label="Service Account JSON" 
          placeholder="Paste JSON credentials..." 
          styles={inputStyles} 
          description="Vertex AI authenticated credentials."
          value={modelConfig.credentials || ""}
          onChange={(e) => handleUpdate("credentials", e.target.value)}
        />
      </Grid.Col>
    </Grid>
  );
}
