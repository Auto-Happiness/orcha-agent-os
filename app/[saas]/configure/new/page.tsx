"use client";

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
  IconSettingsCheck
} from "@tabler/icons-react";
import { useRouter, useParams } from "next/navigation";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { DatabaseConfig } from "@/components/Configure/DatabaseConfig";
import { LLMConfig } from "@/components/Configure/LLMConfig";
import { WizardDetailsStep } from "@/components/Configure/WizardDetailsStep";

export default function NewConfigurationPage() {
  const { saas } = useParams();
  const router = useRouter();
  const { step, setStep, reset } = useCreationWizard();

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else router.push(`/${saas}/configure`);
  };

  const handleNext = () => {
    setStep(step + 1);
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
          <Text c="dimmed" size="md">Connect your database, pair it with AI intelligence, and deploy it to your workspace.</Text>
        </Box>

        <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} />

        <Stepper 
          active={step} 
          onStepClick={setStep} 
          color="violet" 
          iconSize={42}
          allowNextStepsSelect={false}
          styles={{
            step: { transition: "transform 150ms ease" },
            stepIcon: { border: "1px solid rgba(147,51,234,0.2)", background: "rgba(0,0,0,0.2)" },
            stepDescription: { fontSize: rem(10), textTransform: "uppercase", letterSpacing: rem(1) }
          }}
        >
          {/* Step 1: Database Selector */}
          <Stepper.Step 
            label="Database" 
            description="Select Data Source"
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
                    Connect and Select Model
                  </Button>
               </Group>
            </Stack>
          </Stepper.Step>

          {/* Step 2: Model Selector */}
          <Stepper.Step 
            label="Intelligence" 
            description="Pair AI Engine"
            icon={<IconRobot size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <Box>
                <Title order={3} size="h3" c="white" mb={4}>Cognitive Processing Engine</Title>
                <Text size="xs" c="dimmed">Configure the large language model that will interface with your data source.</Text>
              </Box>
              
              <LLMConfig />

              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />
              
              <Group justify="space-between">
                <Button variant="subtle" color="dimmed" onClick={handleBack}>Previous: Database Settings</Button>
                <Button color="violet" size="md" onClick={handleNext} rightSection={<IconArrowRight size={16} />}>
                  Finalize Connection Identity
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          {/* Step 3: Metadata Details */}
          <Stepper.Step 
            label="Finalize" 
            description="Environment Branding"
            icon={<IconSettingsCheck size={20} />}
          >
            <Stack gap="xl" py="2rem">
              <Box>
                <Title order={3} size="h3" c="white" mb={4}>Deployment Profile</Title>
                <Text size="xs" c="dimmed">Assign a unique name, avatar, and searchable tags to this environment.</Text>
              </Box>

              <WizardDetailsStep />

              <Divider style={{ borderColor: "rgba(147,51,234,0.12)" }} my="xl" />

              <Group justify="space-between">
                <Button variant="subtle" color="dimmed" onClick={handleBack}>Previous: Intelligence Settings</Button>
                <Button color="violet" size="lg" px={50} onClick={() => {
                  alert("Environment Initialized!");
                  reset();
                  router.push(`/${saas}/configure`);
                }} leftSection={<IconCheck size={18} />}>Initialize Environment</Button>
              </Group>
            </Stack>
          </Stepper.Step>
        </Stepper>
      </Stack>
    </Container>
  );
}
