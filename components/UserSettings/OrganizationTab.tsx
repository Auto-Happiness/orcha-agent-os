"use client";

import { 
  Stack, 
  Paper, 
  Group, 
  Title, 
  Text, 
  Badge, 
  TextInput, 
  Select, 
  Button 
} from "@mantine/core";
import { useOrganization } from "@clerk/nextjs";
import { inputStyles } from "@/lib/styles";

export function OrganizationTab() {
  const { organization } = useOrganization();

  return (
    <Paper withBorder p="2.5rem" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={3} size="1.5rem">{organization?.name || "Organization Settings"}</Title>
          <Badge color="violet" variant="light">PRO PLAN</Badge>
        </Group>

        <Stack gap="md">
          <TextInput label="Organization Name" defaultValue={organization?.name || ""} styles={inputStyles} />
          <TextInput label="Domain" placeholder="acme.com" styles={inputStyles} />
          <Select
            label="Default Language Model"
            defaultValue="gemini-1.5-flash"
            data={[
              { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Fast)" },
              { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Powerful)" }
            ]}
            styles={inputStyles}
          />
        </Stack>

        <Group justify="flex-end">
          <Button color="violet" radius="md" size="md">Update Organization</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
