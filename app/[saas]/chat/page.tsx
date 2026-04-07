"use client";

import { useChat } from "@ai-sdk/react";
import {
  TextInput,
  Button,
  Stack,
  Paper,
  Text,
  Group,
  ScrollArea,
  Box,
  Alert,
  Badge,
  Avatar,
  Loader,
  Table,
  ActionIcon,
  rem,
  Title,
  UnstyledButton,
  Transition,
  Center,
  Grid,
  Tooltip,
  Select,
  Divider
} from "@mantine/core";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { IconDatabaseOff } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { WelcomeScreen } from "@/components/Chat/WelcomeScreen";
import { ChatMessages } from "@/components/Chat/ChatMessages";
import { ChatPromptBox } from "@/components/Chat/ChatPromptBox";

export default function ChatPage() {
  const { saas } = useParams();
  const { user, isLoaded, isSignedIn } = useUser();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  
  // Environment selection
  const allConfigs = useQuery(
    api.databaseConfigs.listByOrganization, 
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  // Sync initial config
  useEffect(() => {
    if (allConfigs && allConfigs.length > 0 && !selectedConfigId) {
      setSelectedConfigId(allConfigs[0]._id);
    }
  }, [allConfigs, selectedConfigId]);

  const isConnected = useQuery(
    api.databaseConfigs.isConnected,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );
  
  // AI Keys and Model Selection
  const aiKeys = useQuery(
    api.aiKeys.listByOrganization, 
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );
  const [selectedModel, setSelectedModel] = useState<string>("gemini:gemini-1.5-flash");

  const { messages, input, setInput, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/chat",
    body: { 
      organizationId: activeOrg?._id,
      configId: selectedConfigId,
      slug: saas,
      modelId: selectedModel 
    },
  } as any) as any;

  const isLoading = status === "streaming" || status === "submitted";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading]);

  if (isConnected === false) {
    return (
      <Center h="70vh">
        <Box p="xl" maw={500} ta="center">
          <Avatar size={80} radius="xl" color="red" mx="auto" mb="xl">
            <IconDatabaseOff size={40} />
          </Avatar>
          <Title order={2} c="white" mb="sm">No Database Connected</Title>
          <Text c="dimmed" mb="xl">The Agent needs a data source to answer queries. Connect your database to begin.</Text>
          <Button component="a" href={`/${saas}/configure`} color="violet" size="md" radius="md">
            Go to Settings
          </Button>
        </Box>
      </Center>
    );
  }

  return (
    <Box h="calc(100vh - 100px)" pos="relative" style={{ overflow: "hidden" }}>
      <Stack h="100%" gap={0} mx="auto" maw={900} p="md">
        
        {/* ── Chat Canvas ────────────────────────────────────────────── */}
        <ScrollArea 
          viewportRef={scrollRef} 
          style={{ flex: 1 }} 
          scrollbarSize={6}
        >
          <Stack gap={40} py="4rem">
            
            {/* ── Welcome Screen ── */}
            {messages.length === 0 && (
              <WelcomeScreen user={user} setInput={setInput} />
            )}

            {/* ── Messages & Tool Invocations ── */}
            <ChatMessages messages={messages} isLoading={isLoading} />
            
          </Stack>
        </ScrollArea>

        {/* ── Fixed Prompt Pill ─────────────────────────── */}
        <ChatPromptBox 
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          allConfigs={allConfigs || []}
          selectedConfigId={selectedConfigId}
          setSelectedConfigId={setSelectedConfigId}
          aiKeys={aiKeys || []}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
        />

      </Stack>
    </Box>
  );
}
