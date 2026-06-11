import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  TextInput,
  Button,
  ActionIcon,
  Divider,
  Box,
  rem,
  Tooltip,
  Skeleton,
  Center,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Code,
  Avatar,
  Tabs,
  ScrollArea
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconNotebook,
  IconLayoutGrid,
  IconList,
  IconTrash,
  IconCopy,
  IconCalendar,
  IconDatabase,
  IconCircleCheck,
  IconPencil,
  IconBrandMysql,
  IconBrandMongodb,
  IconTableFilled,
  IconUser,
  IconSparkles
} from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { DataTable } from "@/components/Chat/DataTable";
import { ReasoningBlock } from "@/components/Chat/ReasoningBlock";

const DB_TYPE_MAP: Record<string, { label: string; icon: React.ElementType }> = {
  postgres: { label: "PostgreSQL", icon: IconDatabase },
  mysql: { label: "MySQL", icon: IconBrandMysql },
  mariadb: { label: "MariaDB", icon: IconDatabase },
  mssql: { label: "MSSQL", icon: IconDatabase },
  oracle: { label: "Oracle", icon: IconDatabase },
  mongodb: { label: "MongoDB", icon: IconBrandMongodb },
  bigquery: { label: "BigQuery", icon: IconTableFilled },
  sqlite: { label: "SQLite", icon: IconDatabase },
};

function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(!)?\[(.+?)\]\((.+?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<Text key={`bold-${match.index}`} component="span" fw={700} c="inherit">{match[1]}</Text>);
    } else if (match[2]) {
      parts.push(<Text key={`italic-${match.index}`} component="span" style={{ fontStyle: "italic" }} c="inherit">{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={`code-${match.index}`} component="span" size="xs" style={{ background: "rgba(147,51,234,0.15)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }} c="violet.2">{match[3]}</Text>);
    } else if (match[5] && match[6]) {
      const linkText = match[5];
      const linkUrl = match[6];
      parts.push(<Text key={`link-${match.index}`} component="a" href={linkUrl} target="_blank" rel="noopener noreferrer" c="violet.3" style={{ textDecoration: "underline", cursor: "pointer" }}>{linkText}</Text>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

interface SavedResultsListProps {
  organizationId: any;
}

export function SavedResultsList({ organizationId }: SavedResultsListProps) {
  const { saas } = useParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<string>("list");
  
  // Rename State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameEntryId, setRenameEntryId] = useState<any | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Convex Queries and Mutations
  const databookEntries = useQuery(api.databook.listByOrg, { organizationId });
  const dbConfigs = useQuery(api.databaseConfigs.listByOrganization, { organizationId });
  const renameMutation = useMutation(api.databook.rename);
  const removeMutation = useMutation(api.databook.remove);

  // Map configs for easy lookups
  const configMap = useMemo(() => {
    if (!dbConfigs) return new Map();
    return new Map(dbConfigs.map(c => [c._id, c]));
  }, [dbConfigs]);

  // Client-side Filtering Logic
  const filteredEntries = useMemo(() => {
    if (!databookEntries) return [];

    return databookEntries.filter((entry: any) => {
      const queryText = search.toLowerCase();
      return (
        entry.name.toLowerCase().includes(queryText) ||
        entry.question.toLowerCase().includes(queryText) ||
        entry.sql.toLowerCase().includes(queryText)
      );
    });
  }, [databookEntries, search]);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    notifications.show({
      title: "SQL Copied",
      message: "SQL query copied to clipboard.",
      color: "violet",
      autoClose: 2000,
    });
  };

  const handleOpenRename = (e: React.MouseEvent, id: any, currentName: string) => {
    e.stopPropagation();
    setRenameEntryId(id);
    setNewName(currentName);
    setRenameModalOpen(true);
  };

  const handleRename = async () => {
    if (!renameEntryId || !newName.trim()) return;
    setRenaming(true);
    try {
      await renameMutation({ id: renameEntryId, name: newName.trim() });
      notifications.show({
        title: "Rename Successful",
        message: "The query result name has been updated.",
        color: "violet",
        autoClose: 2000,
      });
      setRenameModalOpen(false);
    } catch (err: any) {
      notifications.show({
        title: "Rename Failed",
        message: err.message || "Failed to rename query result.",
        color: "red",
      });
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this saved result from your Databook?")) return;

    try {
      await removeMutation({ id });
      notifications.show({
        title: "Deleted Successfully",
        message: "The query result was deleted from your Databook.",
        color: "violet",
        autoClose: 2000,
      });
    } catch (err: any) {
      notifications.show({
        title: "Delete Failed",
        message: err.message || "Failed to delete query result.",
        color: "red",
      });
    }
  };

  if (databookEntries === undefined || dbConfigs === undefined) {
    return (
      <Stack gap="md">
        <Skeleton h={80} radius="md" />
        <Skeleton h={80} radius="md" />
        <Skeleton h={80} radius="md" />
      </Stack>
    );
  }

  if (databookEntries.length === 0) {
    return (
      <Paper withBorder p="3rem" radius="md" style={{ background: "rgba(255,255,255,0.012)", borderColor: "rgba(147,51,234,0.15)" }}>
        <Stack align="center" gap="sm">
          <IconNotebook size={48} color="rgba(147,51,234,0.3)" />
          <Text fw={600} c="white">Your Databook is empty</Text>
          <Text size="xs" c="dimmed" mb="md" ta="center">
            Save query results in the Chat screen to reuse them here later without re-running.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="xl" mb={40}>
      <Group justify="space-between">
        <Group gap="md">
          <TextInput
            placeholder="Search saved results..."
            leftSection={<IconSearch size={14} />}
            styles={inputStyles}
            w={300}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Group>

        <SegmentedControl
          value={viewMode}
          onChange={setViewMode}
          data={[
            { label: <Center><IconList size={16} /><Text size="xs" ml={6}>List</Text></Center>, value: "list" },
            { label: <Center><IconLayoutGrid size={16} /><Text size="xs" ml={6}>Grid</Text></Center>, value: "grid" }
          ]}
          styles={{
            root: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(147,51,234,0.15)" },
            indicator: { background: "rgba(147,51,234,0.25)" },
            label: { color: "rgba(255,255,255,0.7)" }
          }}
        />
      </Group>

      {viewMode === "list" ? (
        /* ─── List View ─── */
        <Paper withBorder style={{
          background: "rgba(255,255,255,0.012)",
          borderColor: "rgba(147,51,234,0.12)",
          overflow: "hidden"
        }} radius="md">
          <Stack gap={0}>
            {filteredEntries.map((entry: any, index: number) => {
              const config = entry.configId ? configMap.get(entry.configId) : null;
              const dbInfo = config ? DB_TYPE_MAP[config.type] : null;
              const DbIcon = dbInfo ? dbInfo.icon : IconDatabase;
              let rowCount = 0;
              try {
                rowCount = JSON.parse(entry.resultRows).length;
              } catch (_) {}

              return (
                <Box
                  key={entry._id}
                  style={{
                    borderBottom: index !== filteredEntries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "all 200ms ease"
                  }}
                >
                  <Group
                    p="md"
                    justify="space-between"
                    wrap="nowrap"
                    style={{
                      background: "transparent",
                      transition: "all 200ms ease",
                      cursor: "pointer",
                    }}
                    className="config-row-hover"
                    onClick={() => router.push(`/${saas}/databook/${entry._id}`)}
                  >
                    <style jsx>{`
                      .config-row-hover {
                        transition: all 0.2s ease;
                      }
                      .config-row-hover:hover {
                        background: rgba(147, 51, 234, 0.05) !important;
                        box-shadow: inset 2px 0 0 #9333ea;
                      }
                    `}</style>
                    <Group gap="xl">
                      {/* Identity Details */}
                      <Group gap="md">
                        <Avatar
                          color="violet"
                          radius="md"
                          size="md"
                          style={{ border: "1px solid rgba(147,51,234,0.2)" }}
                        >
                          <IconNotebook size={18} />
                        </Avatar>
                        <Stack gap={2}>
                          <Text fw={600} size="sm" c="white">{entry.name}</Text>
                          {entry.question && (
                            <Text size="xs" c="dimmed" style={{ fontStyle: "italic", maxWidth: "400px" }} truncate>
                              "{entry.question}"
                            </Text>
                          )}
                        </Stack>
                      </Group>
                    </Group>

                    <Group gap={rem(48)}>
                      {/* Metadata Details */}
                      <Group gap={40}>
                        <Stack gap={0} w={150}>
                          {config && dbInfo && (
                            <Group gap="xs">
                              <DbIcon size={14} color="#9333ea" />
                              <Text size="11px" fw={500} c="white">{config.name}</Text>
                            </Group>
                          )}
                          <Group gap={4} mt={2}>
                            <IconCircleCheck size={10} color="#22c55e" />
                            <Text size="10px" c="#22c55e" fw={500}>{rowCount} cached rows</Text>
                          </Group>
                        </Stack>
                        
                        {/* Calendar info */}
                        <Group gap="xs" w={120}>
                          <IconCalendar size={12} color="rgba(255,255,255,0.3)" />
                          <Text size="xs" c="dimmed">
                            {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(entry.createdAt)}
                          </Text>
                        </Group>
                      </Group>

                      {/* Row Actions */}
                      <Group gap="md">
                        <Tooltip label="Rename">
                          <ActionIcon
                            variant="subtle"
                            color="violet"
                            size="sm"
                            onClick={(e) => handleOpenRename(e, entry._id, entry.name)}
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={(e) => handleDelete(e, entry._id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Group>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      ) : (
        /* ─── Grid View ─── */
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {filteredEntries.map((entry: any) => {
            const config = entry.configId ? configMap.get(entry.configId) : null;
            const dbInfo = config ? DB_TYPE_MAP[config.type] : null;
            const DbIcon = dbInfo ? dbInfo.icon : IconDatabase;
            let rowCount = 0;
            let colCount = 0;
            try {
              const rows = JSON.parse(entry.resultRows);
              rowCount = rows.length;
              if (rows.length > 0) colCount = Object.keys(rows[0]).length;
            } catch (_) {}

            return (
              <Paper
                key={entry._id}
                withBorder
                p="md"
                radius="md"
                style={{
                  background: "rgba(255,255,255,0.015)",
                  borderColor: "rgba(147,51,234,0.12)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 180,
                  cursor: "pointer",
                  transition: "all 200ms ease"
                }}
                className="grid-card-hover"
                onClick={() => router.push(`/${saas}/databook/${entry._id}`)}
              >
                <style jsx>{`
                  .grid-card-hover:hover {
                    transform: translateY(-2px);
                    border-color: rgba(147, 51, 234, 0.3) !important;
                    background: rgba(147, 51, 234, 0.04) !important;
                  }
                `}</style>
                <Stack gap="xs" style={{ flexGrow: 1 }}>
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Text fw={600} size="sm" c="white" truncate style={{ flexGrow: 1 }}>{entry.name}</Text>
                    {config && (
                      <Badge size="xs" variant="light" color="violet" leftSection={dbInfo ? <DbIcon size={10} /> : null}>
                        {config.name}
                      </Badge>
                    )}
                  </Group>

                  {entry.question && (
                    <Text size="xs" c="dimmed" style={{ fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      "{entry.question}"
                    </Text>
                  )}

                  <Box style={{ background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: "6px 10px", maxHeight: 50, overflow: "hidden" }}>
                    <Code block style={{ background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 10, padding: 0 }}>
                      {entry.sql}
                    </Code>
                  </Box>
                </Stack>

                <Box mt="md">
                  <Divider color="rgba(255,255,255,0.04)" mb="xs" />
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Badge size="xs" color="green" variant="dot">
                        {rowCount} rows · {colCount} cols
                      </Badge>
                    </Group>

                    <Group gap={6}>
                      <ActionIcon
                        variant="subtle"
                        color="violet"
                        size="sm"
                        onClick={(e) => handleOpenRename(e, entry._id, entry.name)}
                      >
                        <IconPencil size={13} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={(e) => handleDelete(e, entry._id)}
                      >
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Box>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

      {/* ─── Rename Modal ─── */}
      <Modal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title={<Text fw={700} c="white">Rename Saved Query</Text>}
        centered
        styles={{
          content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.18)" },
          header: { background: "#130f22" },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Query Name"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            data-autofocus
            styles={{
              input: {
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(147,51,234,0.15)",
                color: "white"
              },
              label: { color: "white" }
            }}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setRenameModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="violet"
              loading={renaming}
              onClick={handleRename}
            >
              Rename
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
