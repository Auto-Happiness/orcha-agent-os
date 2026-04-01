import { Grid, Select, PasswordInput, Stack, Text, Slider } from "@mantine/core";
import { inputStyles, selectStyles } from "@/lib/styles";

export function AnthropicForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Select
          label="Model Version"
          data={["Claude 3.5 Sonnet", "Claude 3.5 Haiku", "Claude 3 Opus"]}
          defaultValue="Claude 3.5 Sonnet"
          styles={selectStyles}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed">Temperature</Text>
          <Slider defaultValue={1.0} min={0} max={1} step={0.1} color="violet" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <PasswordInput 
          label="Anthropic API Key" 
          placeholder="sk-ant-..." 
          styles={inputStyles} 
          description="Claude AI inference credentials."
        />
      </Grid.Col>
    </Grid>
  );
}
