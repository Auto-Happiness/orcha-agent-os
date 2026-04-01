"use client";

import { 
  Title, 
  Text, 
  Stack, 
  Box, 
  Divider,
  Container,
  Group,
  Button,
} from "@mantine/core";
import { useParams } from "next/navigation";
import { SavedConfigsList } from "@/components/Configure/SavedConfigsList";
import { DatasetList } from "@/components/Configure/DatasetList";

export default function ConfigurePage() {
  const { saas } = useParams();

  return (
    <Box p="4rem" style={{ maxWidth: "1600px" }}>
      <Stack gap="4rem">
        <Box mb="xl">
          <Title order={1} c="white" size="2rem" mb="xs" style={{ letterSpacing: "-0.02em" }}>
            Workspace Configurations
          </Title>
          <Text c="dimmed" size="md">Manage your secure database connections and model intelligence.</Text>
        </Box>

        {/* ── Saved Configurations ─────────────────────────────────────── */}
        <Box>
          <SavedConfigsList />
        </Box>
      </Stack>
    </Box>
  );
}
