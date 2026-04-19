"use client";
import { useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { notifications } from "@mantine/notifications";

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
} from "@tabler/icons-react";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { DatabaseConfig } from "@/components/Configure/DatabaseConfig";
import { LLMConfig } from "@/components/Configure/LLMConfig";
import { WizardDetailsStep } from "@/components/Configure/WizardDetailsStep";
import { CatalogScan } from "@/components/Configure/CatalogScan";
import { SemanticBridge } from "@/components/Configure/SemanticBridge";
import { MemoryConfig } from "@/components/Configure/MemoryConfig";

export default function NewConfigurationPage() {
  const { saas } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const { step, setStep, reset, data } = useCreationWizard();
  const finalizeConfiguration = useMutation(api.databaseConfigs.finalizeConfiguration);

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

  const onStepClick = (newStep: number) => {
    updateUrlForStep(newStep);
  };

  return (
    <Container size="xl" py="4rem">
      <Stack gap="3rem">
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
                  <Button color="violet" size="md" onClick={handleNext} rightSection={<IconArrowRight size={16} />}>
                    Connect and Scan Schema
                  </Button>
               </Group>
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
