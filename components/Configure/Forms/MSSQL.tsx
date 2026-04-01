import { Grid, TextInput, PasswordInput, Select } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { inputStyles, selectStyles } from "@/lib/styles";

export function MSSQLForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput label="Server Instance" placeholder="e.g. sql-server-instance.db.net" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput label="Port" placeholder="1433" defaultValue="1433" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput label="Login (sa / user)" placeholder="sql_user" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <PasswordInput label="Password" placeholder="••••••••" leftSection={<IconLock size={14} />} styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 7 }}>
        <TextInput label="Default Database" placeholder="master" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 5 }}>
        <Select 
          label="Authentication" 
          data={["SQL Server Auth", "Mixed Mode", "AD / OAuth"]} 
          defaultValue="SQL Server Auth"
          styles={selectStyles}
        />
      </Grid.Col>
    </Grid>
  );
}
