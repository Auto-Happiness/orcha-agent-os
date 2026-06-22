"use client";

import { Stack, Divider } from "@mantine/core";
import { MemoryHistoryTable } from "./MemoryHistoryTable";
import { MemoryInstructionsTable } from "./MemoryInstructionsTable";

interface MemoryStatusProps {
  currentConfig: any;
  activeOrgId: any;
}

export function MemoryStatus({ currentConfig, activeOrgId }: MemoryStatusProps) {
  return (
    <Stack gap="xl">
      <MemoryHistoryTable configId={currentConfig._id} organizationId={activeOrgId} />

      <Divider style={{ opacity: 0.08 }} my="md" />

      <MemoryInstructionsTable configId={currentConfig._id} organizationId={activeOrgId} />
    </Stack>
  );
}
