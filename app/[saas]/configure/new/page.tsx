"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useConvexAuth, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { notifications } from "@mantine/notifications";
import { useUser, useOrganization } from "@clerk/nextjs";
import { IconShieldCheck } from "@tabler/icons-react";

import {
  Container,
  Stack,
  Text,
  Box,
  Button,
  Group,
  Title,
  Divider,
  Stepper,
  rem,
  Loader,
  Modal,
  Progress,
  ActionIcon,
  Alert,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconDatabase,
  IconRobot,
  IconArrowRight,
  IconCheck,
  IconFingerprint,
  IconSettingsCheck,
  IconAlertTriangle,
  IconBrain,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { DatabaseConfig } from "@/components/Configure/DatabaseConfig";
import { LLMConfig } from "@/components/Configure/LLMConfig";
import { WizardDetailsStep } from "@/components/Configure/WizardDetailsStep";
import { MemoryConfig } from "@/components/Configure/MemoryConfig";

const CatalogScan = dynamic(() => import("@/components/Configure/CatalogScan").then(m => m.CatalogScan), {
  loading: () => (
    <Stack align="center" py="3rem">
      <Loader color="violet" size="lg" type="dots" />
      <Text size="sm" c="dimmed">Initializing catalog discovery...</Text>
    </Stack>
  ),
  ssr: false
});

const SemanticBridge = dynamic(() => import("@/components/Configure/SemanticBridge").then(m => m.SemanticBridge), {
  loading: () => (
    <Stack align="center" py="3rem">
      <Loader color="violet" size="lg" type="dots" />
      <Text size="sm" c="dimmed">Preparing semantic modeling environment...</Text>
    </Stack>
  ),
  ssr: false
});

export default function NewConfigurationPage() {
  const { saas } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const { step, setStep, reset, data, updateData } = useCreationWizard();
  const finalizeConfiguration = useMutation(api.databaseConfigs.finalizeConfiguration);
  const [showScanConfirm, setShowScanConfirm] = useState(false);

  // Identity & Persistence
  const { user } = useUser();
  const { organization } = useOrganization();
  const [initializing, setInitializing] = useState(false);
  const currentUser = useQuery(api.users.getCurrentUser);
  const syncOrg = useMutation(api.webhooks.syncOrganization);
  const syncUser = useMutation(api.users.storeUser);
  const saveConfig = useMutation(api.databaseConfigs.createOrUpdate);
  const cancelIndexing = useAction(api.embeddings.cancelIndexing);
  const config = useQuery(api.databaseConfigs.getById, data.configId ? { configId: data.configId as any } : "skip");

  // AI & Semantic Logic
  const suggestRelationships = useMutation(api.semanticModels.suggestRelationships);
  const generateAiEnrichment = useAction(api.semanticModels.generateAiEnrichment);
  const indexConfigSchema = useAction(api.embeddings.indexConfigSchema);
  
  const isIndexing = config?.indexingStatus === "processing";
  const progress = config?.indexingTotal ? Math.round(((config?.indexingProgress || 0) / config.indexingTotal) * 100) : 0;

  // ─── Browser Exit Warning ───
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isIndexing) {
        e.preventDefault();
        e.returnValue = "Indexing is still in progress. Closing this tab won't stop the background task. Would you like to cancel it first?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isIndexing]);

  // Auth & Keys for validation
  const { isAuthenticated } = useConvexAuth();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const aiKeys = useQuery(api.aiKeys.listByOrganization, (isAuthenticated && activeOrg?._id) ? { organizationId: activeOrg._id } : "skip");

  const hasKey = data.memoryProvider ? (data.memoryProvider === "local" || (aiKeys?.some(k => k.provider === data.memoryProvider))) : false;
  const isFinalStep = step === 4;

  const stepMapping: Record<string, number> = {
    "connectivity": 0,
    "catalog": 1,
    "bridge": 2,
    "memory": 3,
    "finalize": 4,
  };

  const reverseMapping = Object.fromEntries(
    Object.entries(stepMapping).map(([k, v]) => [v, k])
  );

  // Sync step from URL on initial load and param changes
  useEffect(() => {
    if (stepParam && stepMapping[stepParam] !== undefined) {
      if (step !== stepMapping[stepParam]) {
        setStep(stepMapping[stepParam]);
      }
    }
  }, [stepParam]);

  // Sync URL when step changes internally
  const updateUrlForStep = (newStep: number) => {
    const slug = reverseMapping[newStep] || "connectivity";
    router.push(`/${saas}/configure/new?step=${slug}`);
  };

  const handleBack = () => {
    const newStep = Math.max(0, step - 1);
    if (step === 0) {
      router.push(`/${saas}/configure`);
    } else {
      updateUrlForStep(newStep);
    }
  };

  const handleNext = () => {
    updateUrlForStep(step + 1);
  };

  const handleInitializeConnection = async () => {
    if (activeOrg === undefined || currentUser === undefined) {
      notifications.show({
        title: "Loading Identity",
        message: "Please wait a moment while your session resolves.",
        color: "orange",
      });
      return;
    }

    setInitializing(true);
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
        configId: (data.configId || undefined) as any,
        organizationId: finalOrgId as any,
        type: data.dbProvider as any, // Fixed: use data.dbProvider
        encryptedUri: JSON.stringify(data.dbConfig),
        updatedBy: finalUserId as any,
      });

      // 2. Trigger the Semantic Scan
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
          type: data.dbProvider,
          config: data.dbConfig,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const scanResult = await scanResponse.json();

      if (scanResult.success) {
        // Save configId for next steps
        updateData({ configId });

        // Zero-Config: Auto-run AI suggestions and enrichment
        await suggestRelationships({
          organizationId: finalOrgId as any,
          configId: configId as any
        });

        await generateAiEnrichment({
          configId: configId as any,
          businessContext: data.businessContext || "Database source configuration for Orcha Agent OS."
        });

        // ── Vector Indexing For Massive Scale ──
        // Note: memoryProvider is selected in a later step, so we use a safe fallback first
        // and re-run if they change it. But for initialization, we trigger with their current/default choice.
        const preferredProvider = data.memoryProvider || (aiKeys?.find(k => k.provider === "gemini" || k.provider === "openai")?.provider
          || (aiKeys?.some(k => k.provider === "local") ? "local" : "gemini"));

        indexConfigSchema({
          organizationId: finalOrgId as any,
          configId: configId as any,
          provider: preferredProvider as "gemini" | "openai" | "local"
        }).catch(err => console.error("[Indexing] Background task failed:", err));

        notifications.update({
          id: notificationId,
          title: "Connection Ready",
          message: `${scanResult.message} AI models have been enriched.`,
          color: "violet",
          icon: <IconShieldCheck size={16} />,
          loading: false,
          autoClose: 3000,
        });

        handleNext(); // Move to catalog
      } else {
        throw new Error(scanResult.message);
      }
    } catch (err: any) {
      notifications.show({
        title: "Connection Failed",
        message: err.message || "An error occurred while initializing your source.",
        color: "red",
      });
    } finally {
      setInitializing(false);
      setShowScanConfirm(false);
    }
  };

  const onStepClick = (newStep: number) => {
    updateUrlForStep(newStep);
  };

  return (
    <Container size="xl" py="4rem">
      <Stack gap="3rem">
        {/* Indexing Progress Sticky Header */}
        {isIndexing && (
          <Box style={{ 
            position: "fixed", 
            top: 20, 
            right: 20, 
            zIndex: 1000, 
            width: 350,
            pointerEvents: "auto"
          }}>
            <Paper withBorder p="md" shadow="xl" radius="md" style={{ background: "rgba(26, 27, 30, 0.95)", backdropFilter: "blur(8px)", borderColor: "rgba(147,51,234,0.3)" }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconLoader2 size={16} className="animate-spin" color="#a855f7" />
                    <Text size="xs" fw={700} c="white">VECTOR INDEXING ACTIVE</Text>
                  </Group>
                  <Tooltip label="Cancel Indexing & Stop Queue">
                    <ActionIcon 
                      variant="subtle" 
                      color="red" 
                      size="sm" 
                      onClick={() => {
                        if (data.configId) {
                          cancelIndexing({ configId: data.configId as any });
                          notifications.show({ title: "Indexing Stopped", message: "Background queue has been terminated.", color: "red", icon: <IconX size={14} /> });
                        }
                      }}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Progress value={progress} color="violet" size="sm" striped animated />
                <Group justify="space-between">
                  <Text size="10px" c="dimmed">Processed {config?.indexingProgress} of {config?.indexingTotal} tables</Text>
                  <Text size="10px" fw={700} c="violet">{progress}%</Text>
                </Group>
              </Stack>
            </Paper>
          </Box>
        )}

        {/* Navigation Back */}
        <Group>
          <Button
            onClick={handleBack}
            variant="subtle"
            color="dimmed"
            leftSection={<IconChevronLeft size={16} />}
            px={0}
          >
            Back to Configurations
          </Button>
        </Group>

        <Box>
          <Title order={1} c="white" size={rem(32)} mb="xs" style={{ letterSpacing: "-0.02em" }}>
            Initialize Environment
          </Title>
          <Text c="dimmed" size="md">Connect your database, define your semantic bridge, and deploy it to your workspace.</Text>
        </Box>

        <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} />

        <Stepper
          active={step}
          onStepClick={onStepClick}
          color="violet"
          iconSize={42}
          allowNextStepsSelect={false}
          styles={{
            step: { transition: "transform 150ms ease" },
            stepIcon: { border: "1px solid rgba(147,51,234,0.2)", background: "rgba(0,0,0,0.2)" },
            stepDescription: { fontSize: rem(10), textTransform: "uppercase", letterSpacing: rem(1) }
          }}
        >
          {/* Step 1: Connectivity (Data Source) */}
          <Stepper.Step
            label="Connectivity"
            description="Secure Source Link"
            icon={<IconDatabase size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <Box>
                <Title order={3} size="h3" c="white" mb={4}>Primary Data Storage</Title>
                <Text size="xs" c="dimmed">Set up the secure tunnel to your data lake or operational database.</Text>
              </Box>

              <DatabaseConfig />

              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />

              <Group justify="flex-end">
                <Button color="violet" size="md" onClick={() => setShowScanConfirm(true)} loading={initializing} rightSection={<IconArrowRight size={16} />}>
                  Connect and Scan Schema
                </Button>
              </Group>

              {/* Confirmation Modal for Token Usage */}
              <Modal 
                opened={showScanConfirm} 
                onClose={() => setShowScanConfirm(false)} 
                title="Initialize Semantic Scan"
                centered
                radius="md"
                styles={{
                  content: { background: "#1a1b1e", border: "1px solid rgba(147,51,234,0.2)" },
                  header: { background: "#1a1b1e" },
                  title: { color: "white", fontWeight: 700 }
                }}
              >
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    Orcha will now establish a secure tunnel to your data source and begin building your 
                    <Text span c="violet" fw={600}> Semantic Bridge</Text> and 
                    <Text span c="blue" fw={600}> Vector Memory</Text>.
                  </Text>
                  
                  <Box p="sm" bg="rgba(240,140,0,0.1)" style={{ borderLeft: "4px solid #f08c00", borderRadius: "4px" }}>
                    <Group gap="xs">
                      <IconAlertTriangle size={16} color="#f08c00" />
                      <Text size="xs" fw={600} c="orange.4">Credit Usage Warning</Text>
                    </Group>
                    <Text size="xs" c="orange.2" mt={4}>
                      This process involves automated LLM enrichment and vector indexing which will consume 
                      API tokens from your configured providers (Gemini, OpenAI, or Local).
                    </Text>
                  </Box>

                  <Text size="xs" c="dimmed" fs="italic">
                    Proceed only if you are ready to initialize this environment's intelligent layer.
                  </Text>

                  <Group justify="flex-end" mt="md">
                    <Button variant="subtle" color="gray" onClick={() => setShowScanConfirm(false)}>Cancel</Button>
                    <Button 
                      color="violet" 
                      onClick={handleInitializeConnection} 
                      loading={initializing}
                      leftSection={<IconShieldCheck size={16} />}
                    >
                      Initialize & Index
                    </Button>
                  </Group>
                </Stack>
              </Modal>
            </Stack>
          </Stepper.Step>

          {/* Step 2: Catalog Scanning */}
          <Stepper.Step
            label="Catalog"
            description="Scan and Select Tables"
            icon={<IconFingerprint size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <Box>
                <Title order={3} size="h3" c="white" mb={4}>Metadata Extraction</Title>
                <Text size="xs" c="dimmed">Discover tables and columns available in your data source. Selective scanning ensures focus and precision.</Text>
              </Box>

              <Box pt="md">
                {data.configId ? (
                  <CatalogScan configId={data.configId} />
                ) : (
                  <Stack align="center" gap="sm" py="3rem">
                    <IconDatabase size={48} color="rgba(147,51,234,0.4)" />
                    <Text c="dimmed">Please connect a data source in the previous step first.</Text>
                  </Stack>
                )}
              </Box>

              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />

              <Group justify="space-between">
                <Button variant="subtle" color="dimmed" onClick={handleBack}>Previous: Source Link</Button>
                <Button
                  color="violet"
                  size="md"
                  onClick={handleNext}
                  disabled={!data.configId || (data.selectedTables?.length || 0) === 0}
                  rightSection={<IconArrowRight size={16} />}
                >
                  Enter Semantic Bridge
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          {/* Step 3: Semantic Bridge (Modeling) */}
          <Stepper.Step
            label="Semantic Bridge"
            description="Define Business Logic"
            icon={<IconSettingsCheck size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <Box>
                <Title order={3} size="h3" c="white" mb={4}>Semantic Layer (MDL)</Title>
                <Text size="xs" c="dimmed">Map raw database columns to business concepts (Dimensions and Measures). Define the relationships that drive intelligent SQL generation.</Text>
              </Box>

              <Box pt="md">
                {data.configId ? (
                  <SemanticBridge configId={data.configId} />
                ) : (
                  <Stack align="center" gap="sm" py="3rem">
                    <IconDatabase size={48} color="rgba(147,51,234,0.4)" />
                    <Text c="dimmed">Please select tables in the previous step first.</Text>
                  </Stack>
                )}
              </Box>

              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />

              <Group justify="space-between">
                <Button variant="subtle" color="dimmed" onClick={handleBack}>Previous: Metadata Discovery</Button>
                <Button color="violet" size="md" onClick={handleNext} rightSection={<IconArrowRight size={16} />}>
                  Configure Semantic Memory
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          {/* Step 4: Memory Configuration */}
          <Stepper.Step
            label="Memory"
            description="Indexing & RAG Engine"
            icon={<IconBrain size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <MemoryConfig />
              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />
              <Group justify="space-between">
                <Button variant="subtle" color="dimmed" onClick={handleBack}>Previous: Semantic Modeling</Button>
                <Button
                  color="violet"
                  size="md"
                  onClick={handleNext}
                  disabled={!hasKey}
                  rightSection={<IconArrowRight size={16} />}
                >
                  Finalize Deployment Profile
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          {/* Step 4: Final Profile Metadata */}
          <Stepper.Step
            label="Finalize"
            description="Environment Branding"
            icon={<IconCheck size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <Box>
                <Title order={3} size="h3" c="white" mb={4}>Deployment Profile</Title>
                <Text size="xs" c="dimmed">Assign a unique name, avatar, and searchable tags to this environment.</Text>
              </Box>

              <WizardDetailsStep />

              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />

              <Group justify="space-between">
                <Button variant="subtle" color="dimmed" onClick={handleBack}>Previous: Semantic Memory</Button>
                <Button
                  color="violet"
                  size="lg"
                  px={50}
                  disabled={!data.name || !data.configId || !hasKey}
                  onClick={async () => {
                    if (!data.configId) return;

                    try {
                      const identiconUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${data.name || 'orcha'}&backgroundColor=13102a`;

                      await finalizeConfiguration({
                        configId: data.configId as any,
                        name: data.name,
                        description: data.description,
                        image: data.image || identiconUrl,
                        tags: data.tags,
                        modelProvider: data.modelProvider || "google",
                        modelConfig: JSON.stringify(data.modelConfig || {}),
                        businessContext: data.businessContext,
                        memoryProvider: data.memoryProvider || "gemini",
                      });

                      notifications.show({
                        title: "Environment Ready",
                        message: `${data.name} has been successfully initialized.`,
                        color: "violet",
                        icon: <IconCheck size={16} />
                      });

                      reset();
                      router.push(`/${saas}/configure`);
                    } catch (err: any) {
                      notifications.show({
                        title: "Initialization Failed",
                        message: err.message || "An error occurred while finalizing your environment.",
                        color: "red"
                      });
                    }
                  }}
                  leftSection={<IconCheck size={18} />}
                >
                  Initialize Environment
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>
        </Stepper>
      </Stack>
    </Container>
  );
}
