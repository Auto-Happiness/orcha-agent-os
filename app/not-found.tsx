"use client";

import { 
  Title, 
  Text, 
  Button, 
  Stack, 
  Box, 
  Center,
  Container 
} from "@mantine/core";
import Link from "next/link";
import { IconPlanet, IconArrowRight } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <Box h="100vh" style={{ background: "#07050f", overflow: "hidden", position: "relative" }}>
      <title>404 - Lost in Space | Orcha</title>
      
      {/* Decorative background elements */}
      <div 
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none"
        }} 
      />

      <div 
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(147,51,234,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(147,51,234,0.2) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      <Center h="100%" style={{ position: "relative", zIndex: 10 }}>
        <Container size="sm">
          <Stack align="center" gap="xl" style={{ textAlign: "center" }}>
            <Box style={{ position: "relative" }}>
              <IconPlanet 
                size={120} 
                stroke={1.2} 
                color="#a855f7" 
                style={{ 
                  filter: "drop-shadow(0 0 20px rgba(147,51,234,0.4))",
                  animation: "pulse 4s ease-in-out infinite"
                }} 
              />
              <Text 
                style={{ 
                  position: "absolute", 
                  top: "50%", 
                  left: "50%", 
                  transform: "translate(-50%, -50%)",
                  fontSize: "120px",
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.03)",
                  letterSpacing: "-0.05em",
                  userSelect: "none"
                }}
              >
                404
              </Text>
            </Box>

            <Stack gap="xs">
              <Title order={1} c="white" size="3.5rem" style={{ letterSpacing: "-0.04em" }}>
                Lost in the Void
              </Title>
              <Text c="dimmed" size="lg" maw={480} mx="auto">
                The agent you're looking for has drifted beyond the event horizon. 
                This portal has been disconnected or never existed.
              </Text>
            </Stack>

            <Stack gap="md" mt="xl">
              <Button 
                component={Link} 
                href="/redirect" 
                size="xl" 
                radius="xl"
                color="violet"
                rightSection={<IconArrowRight size={20} />}
                style={{
                  background: "linear-gradient(135deg, #9333ea, #7c3aed)",
                  boxShadow: "0 10px 30px rgba(147,51,234,0.3)",
                  transition: "transform 0.2s ease",
                }}
                className="hover:scale-105"
              >
                Return to Station
              </Button>
              
              <Text size="xs" c="dimmed" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Error Code: ARCH-404-ORBITAL-DRIFT
              </Text>
            </Stack>
          </Stack>
        </Container>
      </Center>

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: translateY(0px) rotate(0deg); opacity: 0.8; }
          50% { transform: translateY(-20px) rotate(5deg); opacity: 1; }
          100% { transform: translateY(0px) rotate(0deg); opacity: 0.8; }
        }
      `}</style>
    </Box>
  );
}
