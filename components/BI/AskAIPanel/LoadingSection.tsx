import React from "react";
import { Stack, Loader, Text } from "@mantine/core";

interface LoadingSectionProps {
  currentStep: "idle" | "analyzing" | "designing" | "ready";
  draftPromptsCount: number;
}

export function LoadingSection({ currentStep, draftPromptsCount }: LoadingSectionProps) {
  if (currentStep !== "analyzing" && currentStep !== "designing") return null;

  return (
    <Stack align="center" py={50} gap="md">
      <Loader color="violet" size="lg" type="bars" />
      <Text fw={600} c="violet.3">
        {currentStep === "analyzing" ? "Sit back and relax..." : "Architecting Dashboard..."}
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        Processing {draftPromptsCount} requested insights...
      </Text>
    </Stack>
  );
}
