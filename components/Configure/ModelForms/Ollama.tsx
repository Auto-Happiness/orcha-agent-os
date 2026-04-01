import { Grid, TextInput, PasswordInput, Stack, Text, Slider } from "@mantine/core";
import { inputStyles } from "@/lib/styles";

export function OllamaForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput
          label="Model Tag"
          placeholder="e.g. llama3.2:latest"
          defaultValue="llama3.1"
          styles={inputStyles}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed">Temperature</Text>
          <Slider defaultValue={0.7} min={0} max={1.5} step={0.1} color="violet" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput 
          label="Ollama Endpoint" 
          placeholder="http://127.0.0.1:11434" 
          defaultValue="http://localhost:11434"
          styles={inputStyles} 
          description="Local inference server URL."
        />
      </Grid.Col>
    </Grid>
  );
}
