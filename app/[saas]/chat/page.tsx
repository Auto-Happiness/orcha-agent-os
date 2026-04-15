"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button, Stack, Text, ScrollArea, Box, Avatar, Title, Center } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { IconDatabaseOff } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { WelcomeScreen } from "@/components/Chat/WelcomeScreen";
import { ChatMessages } from "@/components/Chat/ChatMessages";
import { ChatPromptBox } from "@/components/Chat/ChatPromptBox";
import { ChatSessionSidebar } from "@/components/Chat/ChatSessionSidebar";

export default function ChatPage() {
  const { saas } = useParams();
  const { user, isSignedIn } = useUser();
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

  // ── Sessions ────────────────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const createSession = useMutation(api.chatSessions.create);
  const updateTitle = useMutation(api.chatSessions.updateTitle);
  const appendMessage = useMutation(api.chatMessages.append);

  const existingSessions = useQuery(
    api.chatSessions.listByOrganizationAndUser,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  // Initialize once: pick most recent session or create one
  const sessionInitialized = useRef(false);
  useEffect(() => {
    if (!activeOrg?._id || !isSignedIn || sessionInitialized.current) return;
    if (existingSessions === undefined) return;
    sessionInitialized.current = true;

    if (existingSessions.length > 0) {
      setActiveSessionId(existingSessions[0]._id);
    } else {
      createSession({
        organizationId: activeOrg._id,
        configId: selectedConfigId ? selectedConfigId as Id<"databaseConfigs"> : undefined,
        modelId: selectedModel,
      }).then(setActiveSessionId);
    }
  }, [activeOrg?._id, isSignedIn, existingSessions]);

  // Derive whether the active session already has a real title from Convex data
  // This survives page refresh — no need for a ref
  const activeSession = useMemo(
    () => existingSessions?.find(s => s._id === activeSessionId),
    [existingSessions, activeSessionId]
  );
  const sessionAlreadyTitled = activeSession?.title !== "New Chat" && !!activeSession?.title;

  // ── Chat state ──────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [showResults, setShowResults] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeOrgId = activeOrg?._id;

  const chatParamsRef = useRef({ activeOrgId, selectedConfigId, selectedModel, saas, showResults, activeSessionId });
  useEffect(() => {
    chatParamsRef.current = { activeOrgId, selectedConfigId, selectedModel, saas, showResults, activeSessionId };
  }, [activeOrgId, selectedConfigId, selectedModel, saas, showResults, activeSessionId]);

  const { messages, sendMessage, setMessages, status } = useChat({
    id: activeSessionId ?? undefined,
    experimental_throttle: 80, // batch UI updates to max ~12fps during streaming
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        organizationId: chatParamsRef.current.activeOrgId,
        configId: chatParamsRef.current.selectedConfigId,
        modelId: chatParamsRef.current.selectedModel,
        showResults: chatParamsRef.current.showResults,
        sessionId: chatParamsRef.current.activeSessionId,
      }),
    }),
    onError: (error) => {
      setIsStreaming(false);
      console.error("[Chat API Error]", error);
      notifications.show({ title: "Query Failed", message: error.message, color: "red" });
    },
    onFinish: async ({ message }) => {
      setIsStreaming(false);
      const params = chatParamsRef.current;
      if (!params.activeSessionId) return;
      try {
        const textContent = (message.parts as any[])?.find((p: any) => p.type === "text")?.text ?? "";
        // Strip large data arrays from tool parts before storing — keep structure for rendering
        const safeParts = (message.parts as any[])?.map((p: any) => {
          if (p.output && (p.output as any).data && Array.isArray((p.output as any).data)) {
            return { ...p, output: { ...p.output as any, data: (p.output as any).data.slice(0, 20) } };
          }
          return p;
        });
        await appendMessage({
          sessionId: params.activeSessionId as Id<"chatSessions">,
          role: "assistant",
          content: textContent,
          parts: safeParts,
        });
      } catch (e) {
        console.error("[Chat] Failed to persist assistant message:", e);
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Load persisted messages — skip while actively streaming to avoid re-restore mid-conversation
  const persistedMessages = useQuery(
    api.chatMessages.listBySession,
    activeSessionId && !isStreaming ? { sessionId: activeSessionId as Id<"chatSessions"> } : "skip"
  );

  // Restore persisted messages when switching sessions
  const restoredSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSessionId || !persistedMessages || restoredSessionRef.current === activeSessionId) return;
    restoredSessionRef.current = activeSessionId;

    if (persistedMessages.length === 0) {
      setMessages([]);
      return;
    }

    const restored = persistedMessages.map((m) => ({
      id: m._id,
      role: m.role as "user" | "assistant",
      parts: m.parts ?? [{ type: "text", text: m.content }],
      content: m.content,
      createdAt: new Date(m.createdAt),
    }));
    setMessages(restored as any);
  }, [activeSessionId, persistedMessages, setMessages]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !activeOrgId || !activeSessionId) return;

    const text = input;
    setInput("");
    setIsStreaming(true);
    sendMessage({ text });

    // Persist user message
    appendMessage({
      sessionId: activeSessionId as Id<"chatSessions">,
      role: "user",
      content: text,
    }).catch((e) => console.error("[Chat] Failed to persist user message:", e));

    // Auto-title only if session still has default title
    if (!sessionAlreadyTitled) {
      const title = text.length > 40 ? text.slice(0, 40) + "…" : text;
      updateTitle({ sessionId: activeSessionId as Id<"chatSessions">, title }).catch(() => {});
    }
  }, [input, isLoading, activeOrgId, activeSessionId, sendMessage, appendMessage, updateTitle, sessionAlreadyTitled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    restoredSessionRef.current = null;
    setInput("");
    setIsStreaming(false);
  }, []);

  const handleNewSessionClick = useCallback(async () => {
    if (!activeOrg?._id) return;
    const id = await createSession({
      organizationId: activeOrg._id,
      configId: selectedConfigId ? selectedConfigId as Id<"databaseConfigs"> : undefined,
      modelId: selectedModel,
    });
    setActiveSessionId(id);
    setMessages([]);
    restoredSessionRef.current = id;
    setInput("");
    setIsStreaming(false);
  }, [activeOrg?._id, selectedConfigId, selectedModel, createSession, setMessages]);

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
    <Box h="calc(100vh - 56px)" style={{ display: "flex", overflow: "hidden" }}>
      {activeOrg?._id && isSignedIn && (
        <ChatSessionSidebar
          organizationId={activeOrg._id}
          activeSessionId={activeSessionId}
          sessions={existingSessions}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSessionClick}
        />
      )}

      <Stack style={{ flex: 1, minWidth: 0 }} gap={0}>
        <ScrollArea viewportRef={scrollRef} style={{ flex: 1 }} scrollbarSize={6}>
          <Stack gap={40} py="4rem" mx="auto" maw={860} px="md">
            {messages?.length === 0 && (
              <WelcomeScreen user={user} setInput={setInput} />
            )}
            <ChatMessages
              messages={messages || []}
              isLoading={isLoading}
              showResults={showResults}
              organizationId={activeOrgId}
              configId={selectedConfigId}
            />
          </Stack>
        </ScrollArea>

        <Box mx="auto" w="100%" maw={860} px="md">
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
        </Box>
      </Stack>
    </Box>
  );
}
