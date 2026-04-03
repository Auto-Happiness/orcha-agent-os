import { Grid, TextInput, PasswordInput } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function PostgreSQLForm() {
  const { data, updateData } = useCreationWizard();
  const dbConfig = data.dbConfig || {};

  const handleUpdate = (field: string, value: string) => {
    updateData({
      dbConfig: { ...dbConfig, [field]: value }
    });
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput 
          label="Host / Server" 
          placeholder="e.g. 34.120.34.11" 
          styles={inputStyles} 
          value={dbConfig.host || ""}
          onChange={(e) => handleUpdate("host", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput 
          label="Port" 
          placeholder="5432" 
          styles={inputStyles} 
          value={dbConfig.port || "5432"}
          onChange={(e) => handleUpdate("port", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput 
          label="User / Role" 
          placeholder="postgres" 
          styles={inputStyles} 
          value={dbConfig.user || ""}
          onChange={(e) => handleUpdate("user", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <PasswordInput 
          label="Password" 
          placeholder="••••••••" 
          leftSection={<IconLock size={14} />} 
          styles={inputStyles} 
          value={dbConfig.password || ""}
          onChange={(e) => handleUpdate("password", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput 
          label="Database Name" 
          placeholder="production" 
          styles={inputStyles} 
          value={dbConfig.database || ""}
          onChange={(e) => handleUpdate("database", e.target.value)}
        />
      </Grid.Col>
    </Grid>
  );
}
