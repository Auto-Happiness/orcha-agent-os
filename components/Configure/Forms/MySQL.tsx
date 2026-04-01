import { Grid, TextInput, PasswordInput } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";

export function MySQLForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput label="Server Address" placeholder="e.g. mysql-prod.db.internal" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput label="Port" placeholder="3306" defaultValue="3306" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput label="Username" placeholder="root" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <PasswordInput label="Password" placeholder="••••••••" leftSection={<IconLock size={14} />} styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput label="Initial Database" placeholder="main_db" styles={inputStyles} />
      </Grid.Col>
    </Grid>
  );
}
