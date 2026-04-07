"use client";

import { Stack, Paper, Title, Text, Button } from "@mantine/core";
import { IconCreditCard } from "@tabler/icons-react";

export function BillingTab() {
  return (
    <Paper withBorder p="2.5rem" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
      <Stack align="center" py="5rem" gap="md">
        <IconCreditCard size={48} color="rgba(255,255,255,0.1)" stroke={1.2} />
        <Title order={4} size="1.2rem">Payment Methods</Title>
        <Text size="sm" c="dimmed" ta="center" maw={320}>No payment methods found. Add a card to continue using advanced features after your trial expires.</Text>
        <Button variant="outline" color="violet" mt="md" radius="md">Add Payment Method</Button>
      </Stack>
    </Paper>
  );
}
