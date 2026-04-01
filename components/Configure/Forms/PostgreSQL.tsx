import { Grid, TextInput, PasswordInput, Paper, Box, Badge } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";

export function PostgreSQLForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput label="Host / Server" placeholder="e.g. 34.120.34.11" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput label="Port" placeholder="5432" defaultValue="5432" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput label="User / Role" placeholder="postgres" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <PasswordInput label="Password" placeholder="••••••••" leftSection={<IconLock size={14} />} styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput label="Database Name" placeholder="production" styles={inputStyles} />
      </Grid.Col>
    </Grid>
  );
}
