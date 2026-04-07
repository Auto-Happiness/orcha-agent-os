import { Title, Text, Box, Stack, Grid, Paper, ActionIcon } from "@mantine/core";
import { IconDatabaseOff, IconChartBar, IconUser } from "@tabler/icons-react";

interface WelcomeScreenProps {
  user: any;
  setInput: (value: string) => void;
}

export function WelcomeScreen({ user, setInput }: WelcomeScreenProps) {
  const suggestions = [
    { label: "Analyze inventory health", icon: <IconDatabaseOff size={14} />, query: "Give me an overview of our current inventory status." },
    { label: "Sales trends this month", icon: <IconChartBar size={14} />, query: "Show me sales trends for this month compared to last month." },
    { label: "Identify top customers", icon: <IconUser size={14} />, query: "Who are our top 10 customers by revenue?" },
  ];

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

      <Grid grow mt="2rem" w="100%" styles={{ inner: { gap: "var(--mantine-spacing-md)" } }}>
        {suggestions.map((s, i) => (
          <Grid.Col key={i} span={{ base: 12, sm: 4 }}>
            <Paper 
              p="lg" 
              radius="lg" 
              style={{ 
                background: "rgba(255,255,255,0.02)", 
                cursor: "pointer", 
                border: "1px solid rgba(255,255,255,0.05)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(147,51,234,0.05)";
                e.currentTarget.style.borderColor = "rgba(147,51,234,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
              }}
              onClick={() => setInput(s.query)}
            >
               <Stack gap="md">
                 <ActionIcon variant="light" color="violet" radius="md">{s.icon}</ActionIcon>
                 <Text size="sm" fw={500} c="white">{s.label}</Text>
               </Stack>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );
}
