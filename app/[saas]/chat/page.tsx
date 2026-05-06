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
import { trimToolResultParts } from "@/lib/chat-utils";

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
  const updateSessionConfig = useMutation(api.chatSessions.updateConfig);
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
  const activeSession = useMemo(
    () => existingSessions?.find(s => s._id === activeSessionId),
    [existingSessions, activeSessionId]
  );
  const sessionAlreadyTitled = activeSession?.title !== "New Chat" && !!activeSession?.title;

  // ── Chat state ──────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [showResults, setShowResults] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  // ── Sync Session Config ────────────────────────────────────────────────
  // When activeSession changes (e.g. user selects a different session in sidebar),
  // we restore that session's specific environment & model selection.
  useEffect(() => {
    if (!activeSession) return;
    
    if (activeSession.configId && activeSession.configId !== selectedConfigId) {
      console.log("[Chat] Syncing session configId:", activeSession.configId);
      setSelectedConfigId(activeSession.configId);
    }
    
    if (activeSession.modelId && activeSession.modelId !== selectedModel) {
      console.log("[Chat] Syncing session modelId:", activeSession.modelId);
      setSelectedModel(activeSession.modelId);
    }
  }, [activeSession?._id]);

  // Persist changes to the session when the user manually changes the selector
  const handleConfigChange = useCallback((id: string | null) => {
    setSelectedConfigId(id);
    if (activeSessionId && id) {
      updateSessionConfig({ 
        sessionId: activeSessionId as Id<"chatSessions">, 
        configId: id as Id<"databaseConfigs"> 
      }).catch(console.error);
    }
  }, [activeSessionId, updateSessionConfig]);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    if (activeSessionId) {
      updateSessionConfig({ 
        sessionId: activeSessionId as Id<"chatSessions">, 
        modelId: model 
      }).catch(console.error);
    }
  }, [activeSessionId, updateSessionConfig]);

  const activeOrgId = activeOrg?._id;

  const chatParamsRef = useRef({ activeOrgId, selectedConfigId, selectedModel, saas, showResults, activeSessionId });
  useEffect(() => {
    chatParamsRef.current = { activeOrgId, selectedConfigId, selectedModel, saas, showResults, activeSessionId };
  }, [activeOrgId, selectedConfigId, selectedModel, saas, showResults, activeSessionId]);

  const { messages, sendMessage, setMessages, status } = (useChat as any)({
    id: activeSessionId ?? undefined,
    experimental_throttle: 80,
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
    onResponse: async (response: Response) => {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (data.mode === "async") {
          console.log("[Chat] Async job started:", data.jobId);
          setIsStreaming(false);
          return;
        }
      }
    },
    onError: (error: Error) => {
      setIsStreaming(false);
      console.error("[Chat API Error]", error);
      notifications.show({ title: "Query Failed", message: error.message, color: "red" });
    },
    onFinish: async ({ message }: any) => {
      setIsStreaming(false);
      const params = chatParamsRef.current;
      if (!params.activeSessionId) return;
      try {
        const textContent = (message.parts as any[])?.find((p: any) => p.type === "text")?.text ?? "";
        // Use shared trimToolResultParts — same logic as Async mode (chat-worker.ts)
        const safeParts = trimToolResultParts(message.parts as any[]);
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

  const persistedMessages = useQuery(
    api.chatMessages.listBySession,
    activeSessionId && isSignedIn ? { sessionId: activeSessionId as Id<"chatSessions"> } : "skip"
  );

  const restoredSessionRef = useRef<string | null>(null);
  useEffect(() => {
    // In ASYNC mode: always update from Convex (worker is writing to it live)
    // In SYNC mode: only restore when switching sessions (avoid mid-stream overwrite)
    const shouldUpdate = !isStreaming || restoredSessionRef.current !== activeSessionId;
    if (!activeSessionId || !persistedMessages || !shouldUpdate) return;
    restoredSessionRef.current = activeSessionId;

    if (persistedMessages.length === 0) {
      setMessages([]);
      return;
    }

    const restored = persistedMessages.map((m) => {
      const parts = m.parts ?? [{ type: "text", text: m.content }];
      const toolInvocations = parts
        .filter((p: any) => p.type === "tool-invocation" && p.toolInvocation)
        .map((p: any) => p.toolInvocation);

      return {
        id: m._id,
        role: m.role as "user" | "assistant",
        parts,
        content: m.content,
        toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
        createdAt: new Date(m.createdAt),
      };
    });
    setMessages(restored as any);
  }, [activeSessionId, persistedMessages, setMessages, isStreaming]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !activeOrgId || !activeSessionId) return;

    const text = input;
    setInput("");
    setIsStreaming(true);
    sendMessage({ text });

    appendMessage({
      sessionId: activeSessionId as Id<"chatSessions">,
      role: "user",
      content: text,
    }).catch((e) => console.error("[Chat] Failed to persist user message:", e));

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
      <title>Chat</title>
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
            setSelectedConfigId={handleConfigChange}
            aiKeys={aiKeys || []}
            selectedModel={selectedModel}
            setSelectedModel={handleModelChange}
            showResults={showResults}
            setShowResults={setShowResults}
          />
        </Box>
      </Stack>
    </Box>
  );
}
