"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Stack,
  Text,
  ScrollArea,
  Box,
  Avatar,
  Title,
  Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { IconDatabaseOff } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { WelcomeScreen } from "@/components/Chat/WelcomeScreen";
import { ChatMessages } from "@/components/Chat/ChatMessages";
import { ChatPromptBox } from "@/components/Chat/ChatPromptBox";

export default function ChatPage() {
  const { saas } = useParams();
  const { user, isLoaded, isSignedIn } = useUser();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const syncMembership = useMutation(api.memberships.syncMembership);

  useEffect(() => {
    if (activeOrg?._id && isSignedIn) {
      syncMembership({ organizationId: activeOrg._id }).catch(console.error);
    }
  }, [activeOrg?._id, isSignedIn, syncMembership]);

  const allConfigs = useQuery(
    api.databaseConfigs.listByOrganization,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (allConfigs && allConfigs.length > 0 && !selectedConfigId) {
      setSelectedConfigId(allConfigs[0]._id);
    }
  }, [allConfigs, selectedConfigId]);

  const isConnected = useQuery(
    api.databaseConfigs.isConnected,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  const aiKeys = useQuery(
    api.aiKeys.listByOrganization,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orcha_preferred_model") || "gemini:gemini-1.5-flash";
    }
    return "gemini:gemini-1.5-flash";
  });

  useEffect(() => {
    localStorage.setItem("orcha_preferred_model", selectedModel);
  }, [selectedModel]);

  const activeOrgId = activeOrg?._id;
  const [input, setInput] = useState("");
  const [showResults, setShowResults] = useState(true);

  // Use refs so the transport callback always reads the latest values
  const chatParamsRef = useRef({ activeOrgId, selectedConfigId, selectedModel, saas, showResults });
  useEffect(() => {
    chatParamsRef.current = { activeOrgId, selectedConfigId, selectedModel, saas, showResults };
  }, [activeOrgId, selectedConfigId, selectedModel, saas, showResults]);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        organizationId: chatParamsRef.current.activeOrgId,
        configId: chatParamsRef.current.selectedConfigId,
        slug: chatParamsRef.current.saas,
        modelId: chatParamsRef.current.selectedModel,
        showResults: chatParamsRef.current.showResults,
      }),
    }),
    onError: (error) => {
      console.error("[Chat API Error]", error);
      notifications.show({ title: "Query Failed", message: error.message, color: "red" });
    }
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !activeOrgId) return;
    console.log("[UI] Dispatching to SDK");
    sendMessage({ text: input });
    setInput("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };
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

        <ScrollArea
          viewportRef={scrollRef}
          style={{ flex: 1 }}
          scrollbarSize={6}
        >
          <Stack gap={40} py="4rem">

            {messages?.length === 0 && (
              <WelcomeScreen user={user} setInput={setInput} />
            )}

            <ChatMessages messages={messages || []} isLoading={isLoading} showResults={showResults} />

          </Stack>
        </ScrollArea>

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
          showResults={showResults}
          setShowResults={setShowResults}
        />

      </Stack>
    </Box>
  );
}
