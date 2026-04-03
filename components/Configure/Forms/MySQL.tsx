import { Grid, TextInput, PasswordInput, Checkbox, Stack } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function MySQLForm() {
  const { data, updateData } = useCreationWizard();
  const dbConfig = data.dbConfig || {};

  const handleUpdate = (field: string, value: any) => {
    updateData({
      dbConfig: { ...dbConfig, [field]: value }
    });
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput 
          label="Server Address" 
          placeholder="e.g. mysql-prod.db.internal" 
          styles={inputStyles} 
          value={dbConfig.host || ""}
          onChange={(e) => handleUpdate("host", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput 
          label="Port" 
          placeholder="3306" 
          styles={inputStyles} 
          value={dbConfig.port || "3306"}
          onChange={(e) => handleUpdate("port", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput 
          label="Username" 
          placeholder="root" 
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
          label="Initial Database" 
          placeholder="main_db" 
          styles={inputStyles} 
          value={dbConfig.database || ""}
          onChange={(e) => handleUpdate("database", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Checkbox 
          label="Use SSL / TLS connection" 
          description="Required for اکثر cloud providers (DigitalOcean, AWS RDS, etc.)"
          color="violet"
          checked={!!dbConfig.ssl}
          onChange={(e) => handleUpdate("ssl", e.currentTarget.checked)}
        />
      </Grid.Col>
    </Grid>
  );
}
