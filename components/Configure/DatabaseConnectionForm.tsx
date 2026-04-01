import { 
  Stack, 
  Group, 
  Text, 
  Button, 
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Box,
  Badge,
  Grid
} from "@mantine/core";
import { IconCopy, IconShieldCheck, IconInfoCircle } from "@tabler/icons-react";

// Individual Form Components
import { PostgreSQLForm } from "./Forms/PostgreSQL";
import { MySQLForm } from "./Forms/MySQL";
import { MSSQLForm } from "./Forms/MSSQL";
import { MongoDBForm } from "./Forms/MongoDB";
import { BigQueryForm } from "./Forms/BigQuery";

interface ConnectionFormProps {
  provider: string;
}

export function DatabaseConnectionForm({ provider }: ConnectionFormProps) {
  // Dynamic Form Mapping
  const renderForm = () => {
    switch (provider) {
      case "postgres": return <PostgreSQLForm />;
      case "mysql":    return <MySQLForm />;
      case "mssql":    return <MSSQLForm />;
      case "mongodb":  return <MongoDBForm />;
      case "bigquery": return <BigQueryForm />;
      // Fallback/Generic for others 
      default:         return <PostgreSQLForm />; 
    }
  };

  const getUriPreview = () => {
    if (provider === "mongodb") return "mongodb+srv://[user]:[password]@[host]/[database]";
    if (provider === "bigquery") return "google-cloud://[project-id]/[dataset-id]";
    return `${provider}://[user]:[password]@[host]:[port]/[database]`;
  };

  return (
    <Stack gap="xl">
      <Stack gap={10}>
        <Group gap="xs">
          <IconShieldCheck size={18} color="#22c55e" />
          <Text fw={600} size="sm" c="white">Connection Parameters</Text>
          <Badge variant="dot" color="blue" size="xs">{provider.toUpperCase()}</Badge>
        </Group>
      </Stack>

      <Grid>
        {/* Connection String Context Helper */}
        <Grid.Col span={12}>
           <Paper p="md" radius="md" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <Box h={4} bg="rgba(255,255,255,0.05)" style={{ border: "1px solid rgba(255,255,255,0.05)", borderRadius: "100px" }}></Box>
              <Group justify="space-between">
                <Group gap="xs">
                  <IconInfoCircle size={14} color="rgba(255,255,255,0.3)" />
                  <Text size="xs" c="dimmed">Draft Connection URI</Text>
                </Group>
                <Tooltip label="Copy Mapping"><ActionIcon variant="transparent" size="sm" color="dimmed"><IconCopy size={12} /></ActionIcon></Tooltip>
              </Group>
              <Box mt={8}>
                <Text size="11px" style={{ fontFamily: "monospace", color: "#c084fc", opacity: 0.8 }}>
                  {getUriPreview()}
                </Text>
              </Box>
           </Paper>
        </Grid.Col>

        {/* Dynamic Form Content */}
        <Grid.Col span={12}>
          {renderForm()}
        </Grid.Col>
      </Grid>

      <Divider style={{ borderColor: "rgba(255,255,255,0.05)" }} />

      <Group justify="flex-end" mt="md">
        <Button variant="light" color="violet">Test Connection</Button>
        <Button color="violet" px="xl">Save Database</Button>
      </Group>
    </Stack>
  );
}
