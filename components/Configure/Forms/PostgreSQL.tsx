import { Grid, TextInput, PasswordInput, Switch, Group, Text, Stack } from "@mantine/core";
import { IconLock, IconShieldLock } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function PostgreSQLForm() {
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
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <TextInput 
          label="Database Name" 
          placeholder="production" 
          styles={inputStyles} 
          value={dbConfig.database || ""}
          onChange={(e) => handleUpdate("database", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput 
          label="Schema" 
          placeholder="public" 
          styles={inputStyles} 
          value={dbConfig.schema || "public"}
          onChange={(e) => handleUpdate("schema", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Group justify="space-between" mt="xs" p="xs" style={{ 
          background: "rgba(255,255,255,0.02)", 
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.05)" 
        }}>
          <Group gap="xs">
            <IconShieldLock size={16} color="#c084fc" />
            <Stack gap={0}>
              <Text size="sm" fw={500} c="white">Secure Connection (SSL)</Text>
              <Text size="xs" c="dimmed">Enables SSL/TLS encryption for the connection.</Text>
            </Stack>
          </Group>
          <Switch 
            checked={!!dbConfig.ssl}
            onChange={(e) => handleUpdate("ssl", e.currentTarget.checked)}
            color="violet"
          />
        </Group>
      </Grid.Col>
    </Grid>
  );
}
