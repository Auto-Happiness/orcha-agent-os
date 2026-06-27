"use client";

import { 
  Title, 
  Text, 
  Stack, 
  Box, 
  Divider,
  Button,
  Skeleton,
  Center
} from "@mantine/core";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SavedResultsList } from "@/components/Databook/SavedResultsList";

export default function DatabookPage() {
  const { saas } = useParams();
  const organization = useQuery(api.organizations.getSafeBySlug, { 
    slug: saas as string 
  });

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
          <Divider color="var(--orcha-border)" />
          <Skeleton h={300} radius="md" />
        </Stack>
      </Box>
    );
  }

  // Handle Not Found State
  if (organization === null) {
    return (
      <Center h="400px" style={{ color: "var(--orcha-text-title)" }}>
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
      <title>{saas ? `Databook - ${saas}` : "Databook"}</title>
      <Stack gap="4rem">
        <Box mb="xl">
          <Title order={1} c="var(--orcha-text-title)" size="2rem" mb="xs" style={{ letterSpacing: "-0.02em" }}>
            Databook
          </Title>
          <Text c="dimmed" size="md">Access and search saved query results and database insights.</Text>
        </Box>

        {/* ── Saved Databook Results ───────────────────────────────────── */}
        <Box>
          <SavedResultsList organizationId={organization._id} />
        </Box>
      </Stack>
    </Box>
  );
}
