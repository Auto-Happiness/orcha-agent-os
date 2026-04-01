import { Grid, Select, PasswordInput, Stack, Text, Slider, TextInput } from "@mantine/core";
import { inputStyles, selectStyles } from "@/lib/styles";

export function QwenForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Select
          label="Qwen Model Family"
          data={["Qwen-2.5-72B", "Qwen-2.5-Coder", "Qwen-Plus", "Qwen-Turbo"]}
          defaultValue="Qwen-2.5-72B"
          styles={selectStyles}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed">Temperature</Text>
          <Slider defaultValue={0.8} min={0} max={1.2} step={0.1} color="violet" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <PasswordInput 
          label="DashScope API Key" 
          placeholder="sk-..." 
          styles={inputStyles} 
          description="Alibaba Cloud DashScope credentials."
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput 
          label="Region" 
          placeholder="cn-hangzhou" 
          defaultValue="cn-hangzhou"
          styles={inputStyles} 
        />
      </Grid.Col>
    </Grid>
  );
}
