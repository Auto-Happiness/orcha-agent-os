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
  Skeleton,
  Center
} from "@mantine/core";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SavedConfigsList } from "@/components/Configure/SavedConfigsList";
import { useEffect } from "react";

export default function ConfigurePage() {
  const { saas } = useParams();
  const organization = useQuery(api.organizations.getSafeBySlug, { 
    slug: saas as string 
  });

  // Handle Initial Loading State

  // Handle Initial Loading State
  if (organization === undefined) {
    return (
      <Box p="4rem" style={{ maxWidth: "1600px" }}>
        <Stack gap="4rem">
          <Box mb="xl">
             <Skeleton h={40} w={400} mb="xs" radius="md" />
             <Skeleton h={20} w={600} radius="md" />
          </Box>
          <Skeleton h={200} radius="md" mt="xl" />
          <Divider color="rgba(255,255,255,0.05)" />
          <Skeleton h={300} radius="md" />
        </Stack>
      </Box>
    );
  }

  // Handle Not Found State
  if (organization === null) {
    return (
      <Center h="400px" style={{ color: "white" }}>
        <Stack align="center" gap="xs">
          <Title order={3}>Workspace Not Found</Title>
          <Text c="dimmed">The workspace "{saas}" could not be located in the database.</Text>
          <Button component={Link} href="/dashboard" variant="light" color="violet">
            Back to Dashboard
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Box p="4rem" style={{ maxWidth: "1600px" }}>
      <title>{saas ? `Configurations - ${saas}` : "Configurations"}</title>
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
