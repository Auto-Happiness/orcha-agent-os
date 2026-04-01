import { Grid, TextInput, PasswordInput, Select } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { inputStyles, selectStyles } from "@/lib/styles";

export function MongoDBForm() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput label="Cluster / Host URI" placeholder="cluster0.abcde.mongodb.net" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput label="Port" placeholder="27017" defaultValue="27017" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput label="Username" placeholder="mongo_user" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <PasswordInput label="Password" placeholder="••••••••" leftSection={<IconLock size={14} />} styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 7 }}>
        <TextInput label="Auth Database" placeholder="admin" defaultValue="admin" styles={inputStyles} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 5 }}>
        <Select 
          label="Access Pattern" 
          data={["Standalone", "Replica Set", "Sharded Cluster"]} 
          defaultValue="Standalone"
          styles={selectStyles}
        />
      </Grid.Col>
    </Grid>
  );
}
