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
import { IconCopy, IconShieldCheck, IconInfoCircle, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOrganization, useUser } from "@clerk/nextjs";

// Individual Form Components
import { PostgreSQLForm } from "./Forms/PostgreSQL";
import { MySQLForm } from "./Forms/MySQL";
import { MSSQLForm } from "./Forms/MSSQL";
import { MongoDBForm } from "./Forms/MongoDB";
import { BigQueryForm } from "./Forms/BigQuery";
import { SQLiteForm } from "./Forms/SQLite";

interface ConnectionFormProps {
  provider: string;
}

export function DatabaseConnectionForm({ provider }: ConnectionFormProps) {
  const { data, setStep, updateData } = useCreationWizard();
  const { saas } = useParams();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Queries/Mutations
  const { user } = useUser();
  const { organization } = useOrganization();
  const { isAuthenticated } = useConvexAuth();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const currentUser = useQuery(api.users.getCurrentUser);

  const testConnection = async () => {
    setTesting(true);
    try {
      // Build payload — SQLite only needs filePath, no host/user/database
      const payload = provider === "sqlite"
        ? { type: provider, filePath: data.dbConfig?.filePath }
        : { type: provider, ...data.dbConfig };

      const response = await fetch("/api/test-connection", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: "Connection Success",
          message: result.message,
          color: "green",
          icon: <IconShieldCheck size={16} />,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      notifications.show({
        title: "Connection Failed",
        message: error.message || "Failed to reach the database server.",
        color: "red",
      });
    } finally {
      setTesting(false);
    }
  };


  // Dynamic Form Mapping
  const renderForm = () => {
    switch (provider) {
      case "postgres": return <PostgreSQLForm />;
      case "mysql": return <MySQLForm />;
      case "mssql": return <MSSQLForm />;
      case "mongodb": return <MongoDBForm />;
      case "bigquery": return <BigQueryForm />;
      case "sqlite": return <SQLiteForm />;
      default: return <PostgreSQLForm />;
    }
  };

  const getUriPreview = () => {
    if (provider === "sqlite") {
      return `sqlite://${data.dbConfig?.filePath || "[file-path]"}`;
    }
    const { host, port, user, database } = data.dbConfig;
    const h = host || "[host]";
    const p = port || (provider === "postgres" ? "5432" : provider === "mssql" ? "1433" : "3306");
    const u = user || "[user]";
    const d = database || "[database]";

    if (provider === "mongodb") return `mongodb+srv://${u}:****@${h}/${d}`;
    if (provider === "bigquery") return `google-cloud://${h}/${d}`;
    return `${provider}://${u}:****@${h}:${p}/${d}`;
  };

  const useSampleData = () => {
    if (provider === "mysql") {
      updateData({
        dbConfig: {
          host: "db-mysql-fra1-88231-do-user-14675549-0.b.db.ondigitalocean.com",
          port: "25060",
          user: "doadmin",
          password: "AVNS_sample_password",
          database: "defaultdb",
          ssl: true
        }
      });
      notifications.show({
        title: "Sample Settings Applied",
        message: "MySQL test parameters have been loaded.",
        color: "blue",
      });
    }
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

        <Grid.Col span={12}>
          {renderForm()}
        </Grid.Col>
      </Grid>

      <Divider style={{ borderColor: "rgba(255,255,255,0.05)" }} />

      <Group justify="flex-end" mt="md">
        {provider === "mysql" && (
          <Button variant="subtle" color="dimmed" size="xs" onClick={useSampleData}>
            Try with Sample MySQL
          </Button>
        )}
        <Button
          variant="light"
          color="violet"
          onClick={testConnection}
          loading={testing}
          leftSection={<IconRefresh size={16} />}
        >
          Test Connection
        </Button>
      </Group>
    </Stack>
  );
}
