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
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOrganization, useUser } from "@clerk/nextjs";

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
  const { data, setStep, updateData } = useCreationWizard();
  const { saas } = useParams();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Queries/Mutations
  const { user } = useUser();
  const { organization } = useOrganization();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const currentUser = useQuery(api.users.getCurrentUser);
  const saveConfig = useMutation(api.databaseConfigs.createOrUpdate);
  const syncOrg = useMutation(api.webhooks.syncOrganization);
  const syncUser = useMutation(api.users.storeUser);
  const suggestRelationships = useMutation(api.semanticModels.suggestRelationships);
  const generateAiEnrichment = useAction(api.semanticModels.generateAiEnrichment);

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        body: JSON.stringify({
          type: provider,
          ...data.dbConfig,
        }),
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

  const handleSave = async () => {
    if (activeOrg === undefined || currentUser === undefined) {
      notifications.show({
        title: "Loading Identity",
        message: "Please wait a moment while your session resolves.",
        color: "orange",
      });
      return;
    }

    setSaving(true);
    try {
      let finalOrgId: any = activeOrg?._id;
      let finalUserId: any = currentUser?._id;

      // Lazy sync for local development (if webhooks didn't fire)
      if (!finalOrgId) {
        if (!organization) throw new Error("Clerk organization not found in session.");
        finalOrgId = await syncOrg({
          slug: organization.slug || (saas as string),
          name: organization.name,
          clerkOrgId: organization.id,
          type: "organization.created"
        });
      }

      if (!finalUserId) {
        if (!user) throw new Error("Clerk user not found in session.");
        finalUserId = await syncUser({
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || undefined,
          avatarUrl: user.imageUrl,
        });
      }

      // 1. Persist the credentials in Convex
      const configId = await saveConfig({
        configId: data.configId as any,
        organizationId: finalOrgId as any,
        type: provider as any,
        encryptedUri: JSON.stringify(data.dbConfig),
        updatedBy: finalUserId as any,
      });

      // 2. Trigger the "Wren AI" Semantic Scan (Phase 1 Creation)
      const notificationId = "scanning-schema";
      notifications.show({
        id: notificationId,
        title: "Scanning Schema",
        message: "Building your initial semantic models...",
        color: "blue",
        loading: true,
        autoClose: false,
      });

      const scanResponse = await fetch("/api/db/scan", {
        method: "POST",
        body: JSON.stringify({
          configId,
          organizationId: finalOrgId as any,
          type: provider,
          config: data.dbConfig,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const scanResult = await scanResponse.json();

      if (scanResult.success) {
        // Save configId for next steps
        updateData({ configId });

        // Zero-Config: Auto-run AI suggestions and enrichment
        // This ensures the Diagram is populated immediately
        await suggestRelationships({ 
          organizationId: finalOrgId as any, 
          configId: configId as any 
        });
        
        await generateAiEnrichment({ 
          configId: configId as any,
          businessContext: data.businessContext || "Classic models database for a scale model business."
        });

        notifications.update({
          id: notificationId,
          title: "Setup Complete",
          message: `${scanResult.message} AI models have been enriched.`,
          color: "violet",
          icon: <IconShieldCheck size={16} />,
          loading: false,
          autoClose: 3000,
        });
        
        // Move to next step in wizard
        setStep(1);
      } else {
        throw new Error(scanResult.message);
      }
    } catch (err: any) {
      notifications.update({
        id: "scanning-schema",
        title: "Save Failed",
        message: err.message || "An error occurred while saving your configuration.",
        color: "red",
        loading: false,
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
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
      default: return <PostgreSQLForm />;
    }
  };

  const getUriPreview = () => {
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
        <Button
          color="violet"
          px="xl"
          loading={saving}
          onClick={handleSave}
          disabled={!data.dbConfig.host || !data.dbConfig.database}
        >
          Save Database
        </Button>
      </Group>
    </Stack>
  );
}
