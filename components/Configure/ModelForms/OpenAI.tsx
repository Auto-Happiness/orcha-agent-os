import { Grid, Select, PasswordInput, Stack, Text, Slider } from "@mantine/core";
import { inputStyles, selectStyles } from "@/lib/styles";

export function OpenAIForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Select
          label="Model Version"
          data={["GPT-4o", "GPT-4o-mini", "o1-preview", "o1-mini"]}
          defaultValue="GPT-4o"
          styles={selectStyles}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed">Temperature</Text>
          <Slider defaultValue={0.7} min={0} max={2} step={0.1} color="violet" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <PasswordInput 
          label="API Key" 
          placeholder="sk-proj-..." 
          styles={inputStyles} 
          description="OpenAI Platform API Key."
        />
      </Grid.Col>
    </Grid>
  );
}
