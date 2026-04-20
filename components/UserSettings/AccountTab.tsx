"use client";

import { 
  Stack, 
  Paper, 
  Group, 
  Avatar, 
  Title, 
  Text, 
  Button, 
  Divider, 
  TextInput, 
  Switch 
} from "@mantine/core";
import { useUser } from "@clerk/nextjs";
import { inputStyles } from "@/lib/styles";

export function AccountTab() {
  const { user } = useUser();

  return (
    <Stack gap="xl">
      <Paper withBorder p="2.5rem" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
        <Stack gap="2.5rem">
          <Group align="flex-start" gap="2rem">
            <Avatar src={user?.imageUrl} size={100} radius="xl" style={{ border: "2px solid rgba(147,51,234,0.3)" }} />
            <Stack gap="xs" style={{ flex: 1 }}>
              <Title order={3} size="1.5rem">Your Profile</Title>
              <Text size="sm" c="dimmed">This will be displayed on your agent interactions and team logs.</Text>
              <Group mt="md">
                <Button variant="light" color="violet" size="xs" radius="md">Change Avatar</Button>
                <Button variant="subtle" color="red" size="xs">Remove</Button>
              </Group>
            </Stack>
          </Group>

          <Divider color="rgba(255,255,255,0.05)" />

          <Stack gap="md">
            <Group grow>
              <TextInput label="First Name" defaultValue={user?.firstName || ""} styles={inputStyles} />
              <TextInput label="Last Name" defaultValue={user?.lastName || ""} styles={inputStyles} />
            </Group>
            <TextInput label="Primary Email" defaultValue={user?.primaryEmailAddress?.emailAddress || ""} disabled styles={inputStyles} />
          </Stack>

          <Group justify="flex-end">
            <Button color="violet" radius="md" size="md">Save Changes</Button>
          </Group>
        </Stack>
      </Paper>

    </Stack>
  );
}
