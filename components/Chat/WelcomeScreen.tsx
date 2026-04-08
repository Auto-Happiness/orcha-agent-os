import { Title, Box, Stack } from "@mantine/core";

interface WelcomeScreenProps {
  user: any;
  setInput: (value: string) => void;
}

export function WelcomeScreen({ user }: WelcomeScreenProps) {
  return (
    <Stack align="center" gap="xl" py="4rem">
      <Box ta="left" w="100%">
        <Title order={1} size="3.5rem" mb="xs" style={{
          background: "linear-gradient(90deg, #9333ea, #a855f7, #6366f1)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.04em",
          fontWeight: 800
        }}>
          Good morning, {user?.firstName || 'Chief'}.
        </Title>
        <Title order={2} c="rgba(255,255,255,0.4)" size="2.5rem" style={{ letterSpacing: "-0.03em" }}>
          How can I help with your data today?
        </Title>
      </Box>
    </Stack>
  );
}
