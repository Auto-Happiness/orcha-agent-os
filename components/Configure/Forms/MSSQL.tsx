import { Grid, TextInput, PasswordInput, Select, Switch, Stack } from "@mantine/core";
import { IconLock, IconSettings } from "@tabler/icons-react";
import { useEffect } from "react";
import { inputStyles, selectStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { useMssqlStore } from "@/lib/store/useMssqlStore";

export function MSSQLForm() {
  const { updateData } = useCreationWizard();
  const { config, updateConfig } = useMssqlStore();

  // Sync with global store whenever local config changes
  useEffect(() => {
    updateData({
      dbConfig: { ...config }
    });
  }, [config, updateData]);

  return (
    <Stack gap="md">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <TextInput 
            label="Server Instance (Host)" 
            placeholder="e.g. 127.0.0.1" 
            styles={inputStyles} 
            value={config.host}
            onChange={(e) => updateConfig({ host: e.target.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <TextInput 
            label="Port" 
            placeholder="1433" 
            styles={inputStyles} 
            value={config.port}
            onChange={(e) => updateConfig({ port: e.target.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput 
            label="Login" 
            placeholder="sa" 
            styles={inputStyles} 
            value={config.user}
            onChange={(e) => updateConfig({ user: e.target.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <PasswordInput 
            label="Password" 
            placeholder="••••••••" 
            leftSection={<IconLock size={14} />} 
            styles={inputStyles} 
            value={config.password || ""}
            onChange={(e) => updateConfig({ password: e.target.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 7 }}>
          <TextInput 
            label="Default Database" 
            placeholder="Northwind" 
            styles={inputStyles} 
            value={config.database}
            onChange={(e) => updateConfig({ database: e.target.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 5 }}>
          <Select 
            label="Auth Mode" 
            data={["SQL Server Auth", "Mixed Mode", "AD / OAuth"]} 
            value={config.authMode}
            onChange={(value) => updateConfig({ authMode: value as any })}
            styles={selectStyles}
          />
        </Grid.Col>
      </Grid>
      
      <Grid>
        <Grid.Col span={6}>
          <Switch 
            label="Encrypt Connection" 
            size="xs"
            checked={config.encrypt}
            onChange={(e) => updateConfig({ encrypt: e.currentTarget.checked })}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <Switch 
            label="Trust Server Cert" 
            size="xs"
            checked={config.trustServerCertificate}
            onChange={(e) => updateConfig({ trustServerCertificate: e.currentTarget.checked })}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
