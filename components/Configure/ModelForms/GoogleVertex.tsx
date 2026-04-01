import { Grid, Select, PasswordInput, Stack, Text, Slider } from "@mantine/core";
import { inputStyles, selectStyles } from "@/lib/styles";

export function GoogleVertexForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Select
          label="Model Version"
          data={["Gemini 2.0 Flash", "Gemini 1.5 Pro", "Gemini 1.5 Flash"]}
          defaultValue="Gemini 1.5 Pro"
          styles={selectStyles}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed">Temperature</Text>
          <Slider defaultValue={0.7} min={0} max={1} step={0.1} color="violet" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <PasswordInput 
          label="Service Account JSON" 
          placeholder="Paste JSON credentials..." 
          styles={inputStyles} 
          description="Vertex AI authenticated credentials."
        />
      </Grid.Col>
    </Grid>
  );
}
