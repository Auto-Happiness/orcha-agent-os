"use client";

import { Box, Stack, Text, Group, ActionIcon, Tooltip, ScrollArea, Loader, Menu } from "@mantine/core";
import { IconPlus, IconTrash, IconMessage, IconPencil, IconCheck, IconX, IconDots } from "@tabler/icons-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface Session {
  _id: string;
  title: string;
  updatedAt: number;
}

interface ChatSessionSidebarProps {
  organizationId: Id<"organizations">;
  activeSessionId: string | null;
  sessions: Session[] | undefined;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function ChatSessionSidebar({
  organizationId,
  activeSessionId,
  sessions,
  onSelectSession,
  onNewSession,
}: ChatSessionSidebarProps) {
  const removeSession = useMutation(api.chatSessions.remove);
  const updateTitle = useMutation(api.chatSessions.updateTitle);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleRename = async (sessionId: string) => {
    if (editValue.trim()) {
      await updateTitle({ sessionId: sessionId as Id<"chatSessions">, title: editValue.trim() });
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await removeSession({ sessionId: sessionId as Id<"chatSessions"> });
    if (activeSessionId === sessionId) {
      // Select another session if available, otherwise trigger new
      const remaining = sessions?.filter(s => s._id !== sessionId) ?? [];
      if (remaining.length > 0) {
        onSelectSession(remaining[0]._id);
      } else {
        onNewSession();
      }
    }
  };

  return (
    <Box
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid rgba(147,51,234,0.12)",
        background: "#0a0814",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <Group justify="space-between" px="md" py="sm" style={{ borderBottom: "1px solid rgba(147,51,234,0.1)" }}>
        <Text size="xs" fw={600} c="rgba(255,255,255,0.5)" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Conversations
        </Text>
        <Tooltip label="New chat" withArrow position="right">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="violet"
            onClick={onNewSession}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Session list */}
      <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
        <Stack gap={2} p="xs">
          {sessions === undefined && (
            <Box py="xl" style={{ display: "flex", justifyContent: "center" }}>
              <Loader size="xs" color="violet" />
            </Box>
          )}

          {sessions?.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="xl">
              No conversations yet
            </Text>
          )}

          {sessions?.map((session) => {
            const isActive = session._id === activeSessionId;
            const isEditing = editingId === session._id;

            return (
              <Box
                key={session._id}
                onClick={() => !isEditing && onSelectSession(session._id)}
                onMouseEnter={() => setHoveredId(session._id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  background: isActive ? "rgba(147,51,234,0.15)" : hoveredId === session._id ? "rgba(255,255,255,0.04)" : "transparent",
                  border: isActive ? "1px solid rgba(147,51,234,0.2)" : "1px solid transparent",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                {isEditing ? (
                  <Group gap={4} wrap="nowrap">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(session._id);
                        if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(147,51,234,0.3)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        color: "white",
                        fontSize: 12,
                        outline: "none",
                        minWidth: 0,
                      }}
                    />
                    <ActionIcon size="xs" variant="subtle" color="green" onClick={() => handleRename(session._id)}>
                      <IconCheck size={11} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => { setEditingId(null); setEditValue(""); }}>
                      <IconX size={11} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Group gap={6} wrap="nowrap" justify="space-between">
                    <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <IconMessage size={13} color={isActive ? "#a855f7" : "rgba(255,255,255,0.3)"} style={{ flexShrink: 0 }} />
                      <Text size="xs" c={isActive ? "white" : "rgba(255,255,255,0.6)"} fw={isActive ? 500 : 400} truncate style={{ flex: 1 }}>
                        {session.title}
                      </Text>
                    </Group>
                    <Box style={{ opacity: hoveredId === session._id || isActive ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
                      <Menu shadow="md" width={160} position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon size="xs" variant="subtle" color="dimmed" onClick={(e) => e.stopPropagation()}>
                            <IconDots size={13} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown style={{ background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 8 }}>
                          <Menu.Item leftSection={<IconPencil size={13} />} c="rgba(255,255,255,0.75)"
                            onClick={(e) => { e.stopPropagation(); setEditingId(session._id); setEditValue(session.title); }}>
                            Rename
                          </Menu.Item>
                          <Menu.Divider style={{ borderColor: "rgba(255,255,255,0.06)" }} />
                          <Menu.Item leftSection={<IconTrash size={13} />} c="red.4" onClick={(e) => handleDelete(e, session._id)}>
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Box>
                  </Group>
                )}
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
