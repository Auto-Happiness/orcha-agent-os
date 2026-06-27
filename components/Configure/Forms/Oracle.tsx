import { Grid, TextInput, PasswordInput, Switch, Group, Text, Stack } from "@mantine/core";
import { IconLock, IconShieldLock } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { useEffect } from "react";

export function OracleForm() {
  const { data, updateData } = useCreationWizard();
  const dbConfig = data.dbConfig || {};

  // Initialize default port if not set
  useEffect(() => {
    if (!dbConfig.port) {
      updateData({
        dbConfig: { ...dbConfig, port: "1521" }
      });
    }
  }, []);

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
          placeholder="e.g. oracle-db.example.com" 
          styles={inputStyles} 
          value={dbConfig.host || ""}
          onChange={(e) => handleUpdate("host", e.target.value)}
          disabled={!!dbConfig.connectString}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput 
          label="Port" 
          placeholder="1521" 
          styles={inputStyles} 
          value={dbConfig.port !== undefined ? dbConfig.port : "1521"}
          onChange={(e) => handleUpdate("port", e.target.value)}
          disabled={!!dbConfig.connectString}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput 
          label="User" 
          placeholder="system" 
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
          label="Database Name / Service Name" 
          placeholder="ORCL" 
          styles={inputStyles} 
          value={dbConfig.database || ""}
          onChange={(e) => handleUpdate("database", e.target.value)}
          disabled={!!dbConfig.connectString}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput 
          label="Schema (Optional)" 
          placeholder="Defaults to User" 
          styles={inputStyles} 
          value={dbConfig.schema || ""}
          onChange={(e) => handleUpdate("schema", e.target.value)}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput 
          label="Custom Connect String (Optional)" 
          placeholder="e.g. host:port/service_name or full TNS description" 
          styles={inputStyles} 
          value={dbConfig.connectString || ""}
          onChange={(e) => handleUpdate("connectString", e.target.value)}
          description="Overrides Host, Port, and Database settings if provided."
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Group justify="space-between" mt="xs" p="xs" style={{ 
          background: "var(--orcha-surface)", 
          borderRadius: "8px",
          border: "1px solid var(--orcha-border)" 
        }}>
          <Group gap="xs">
            <IconShieldLock size={16} color="#c084fc" />
            <Stack gap={0}>
              <Text size="sm" fw={500} c="var(--orcha-text-title)">Secure Connection (SSL/TLS)</Text>
              <Text size="xs" c="dimmed">Enables secure transport. Ensure wallet is configured or connect string uses TCPS if needed.</Text>
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
