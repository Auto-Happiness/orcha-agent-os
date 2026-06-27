"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Title,
  Text,
  Stack,
  Box,
  Skeleton,
  Center,
  Group,
  Badge,
  Loader,
  Button,
  Menu,
  ActionIcon,
  TextInput,
  Tooltip
} from "@mantine/core";
import Link from "next/link";
import {
  IconArrowLeft,
  IconNotebook,
  IconDotsVertical,
  IconTerminal2,
  IconRefresh,
  IconFilter,
  IconTrash,
  IconPencil,
  IconCheck,
  IconX
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { DataTable } from "@/components/Chat/DataTable";

// Import modular extracted sub-components and hooks
import { SqlQueryDrawer } from "@/components/Databook/SqlQueryDrawer";
import { DeleteConfirmModal } from "@/components/Databook/DeleteConfirmModal";
import { PaginationControls } from "@/components/Databook/PaginationControls";
import { ConversationTranscript } from "@/components/Databook/ConversationTranscript";
import { FilterDrawer, MONTH_OPTIONS } from "@/components/Databook/FilterDrawer";
import { useDateColumns } from "@/components/Databook/useDateColumns";
import { useDatabookQuery } from "@/components/Databook/useDatabookQuery";

export default function DatabookDetailPage() {
  const { saas, id } = useParams();
  const router = useRouter();
  const removeMutation = useMutation(api.databook.remove);
  const renameMutation = useMutation(api.databook.rename);

  // Modal / Drawer / Rename visibility states
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const organization = useQuery(api.organizations.getSafeBySlug, { 
    slug: saas as string 
  });

  const entry = useQuery(api.databook.getById, {
    id: id as any
  });

  const dbConfig = useQuery(
    api.databaseConfigs.getById,
    entry?.configId ? { configId: entry.configId } : "skip"
  );

  const allModels = useQuery(
    api.semanticModels.listModelsByConfig,
    entry?.configId ? { configId: entry.configId } : "skip"
  );

  const saveDateFilterMutation = useMutation(api.databook.saveDateFilter);

  // Custom hook for scanning date columns
  const dateColumns = useDateColumns(allModels, entry);

  // Custom hook for pagination, fetching and filters
  const {
    currentPage,
    setCurrentPage,
    totalCount,
    pageData,
    loadingPage,
    filterRules,
    refreshing,
    PAGE_SIZE,
    handleDelete,
    handleApplyFilter,
    handleClearFilter,
    handleRefresh,
  } = useDatabookQuery({
    saas: saas as string,
    entry,
    dbConfig,
    saveDateFilterMutation,
    removeMutation,
    router,
  });

  const startRename = () => {
    if (!entry) return;
    setTempName(entry.name);
    setIsEditingName(true);
  };

  const handleRenameSave = async () => {
    if (!tempName.trim()) {
      notifications.show({
        title: "Invalid Name",
        message: "Name cannot be empty.",
        color: "red",
        autoClose: 3000,
      });
      return;
    }
    if (tempName.trim() === entry?.name) {
      setIsEditingName(false);
      return;
    }
    setIsRenaming(true);
    try {
      await renameMutation({ id: id as any, name: tempName.trim() });
      setIsEditingName(false);
      notifications.show({
        title: "Rename Successful",
        message: "The query result name has been updated.",
        color: "violet",
        autoClose: 2000,
      });
    } catch (err: any) {
      console.error("[Databook] Rename failed:", err);
      notifications.show({
        title: "Rename Failed",
        message: err.message || "Failed to rename query result.",
        color: "red",
        autoClose: 5000,
      });
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle Initial Loading State
  if (organization === undefined || entry === undefined) {
    return (
      <Box p="4rem" style={{ maxWidth: "1600px" }}>
        <Stack gap="2rem">
          <Skeleton h={30} w={120} radius="md" />
          <Box mb="xl">
             <Skeleton h={40} w={500} mb="xs" radius="md" />
             <Skeleton h={20} w={700} radius="md" />
          </Box>
          <Skeleton h={300} radius="md" />
        </Stack>
      </Box>
    );
  }

  // Handle Not Found State
  if (organization === null || entry === null) {
    return (
      <Center h="400px" style={{ color: "white" }}>
        <Stack align="center" gap="xs">
          <Title order={3}>Record Not Found</Title>
          <Text c="dimmed">This databook entry could not be located in the database.</Text>
          <Button component={Link} href={`/${saas}/databook`} variant="light" color="violet">
            Back to Databook
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Box p="4rem" style={{ maxWidth: "1600px" }}>
      <title>{entry ? `${entry.name} - Databook` : "Saved Query"}</title>
      <Stack gap="2rem">
        <Box>
          <Button
            component={Link}
            href={`/${saas}/databook`}
            variant="subtle"
            color="violet"
            leftSection={<IconArrowLeft size={16} />}
            styles={{
              root: {
                paddingLeft: 0,
                color: "var(--orcha-text-muted)",
                "&:hover": {
                  color: "var(--orcha-purple)",
                  background: "transparent"
                }
              }
            }}
          >
            Back to Databook
          </Button>
        </Box>

        <Group justify="space-between" align="flex-start" mb="xl">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" align="center" mb={6}>
              <IconNotebook size={24} color="#a855f7" />
              {isEditingName ? (
                <Group gap="xs" style={{ flex: 1, maxWidth: "500px" }} wrap="nowrap">
                  <TextInput
                    value={tempName}
                    onChange={(e) => setTempName(e.currentTarget.value)}
                    disabled={isRenaming}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSave();
                      else if (e.key === "Escape") setIsEditingName(false);
                    }}
                    styles={{
                      input: {
                        background: "var(--orcha-surface)",
                        border: "1px solid var(--orcha-border)",
                        color: "var(--orcha-text-title)",
                        fontSize: "1.8rem",
                        fontWeight: 700,
                        height: "auto",
                        padding: "4px 12px",
                        borderRadius: "8px",
                        fontFamily: "inherit",
                        letterSpacing: "-0.02em",
                      }
                    }}
                    autoFocus
                  />
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="green"
                      size="lg"
                      radius="md"
                      onClick={handleRenameSave}
                      loading={isRenaming}
                    >
                      <IconCheck size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      size="lg"
                      radius="md"
                      onClick={() => setIsEditingName(false)}
                      disabled={isRenaming}
                    >
                      <IconX size={18} />
                    </ActionIcon>
                  </Group>
                </Group>
              ) : (
                <Group gap="xs" align="center">
                  <Title order={1} c="var(--orcha-text-title)" size="2rem" style={{ letterSpacing: "-0.02em" }}>
                    {entry.name}
                  </Title>
                  <Tooltip label="Click to rename" position="right" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="violet"
                      size="sm"
                      onClick={startRename}
                      styles={{
                        root: {
                          opacity: 0.4,
                          "&:hover": {
                            opacity: 1,
                            background: "transparent"
                          }
                        }
                      }}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
            </Group>
            {entry.question && (
              <Text c="dimmed" size="md" style={{ fontStyle: "italic" }}>
                "{entry.question}"
              </Text>
            )}
            <Group gap="sm" mt="md" wrap="wrap" align="center">
              {dbConfig ? (
                <>
                  <Badge variant="dot" color="violet" styles={{ label: { textTransform: "none", color: "var(--orcha-text-title)" } }}>
                    Database: {dbConfig.name}
                  </Badge>
                  <Badge variant="light" color="violet" size="sm">
                    {dbConfig.type.toUpperCase()}
                  </Badge>
                </>
              ) : (
                <Badge variant="dot" color="gray" styles={{ label: { textTransform: "none", color: "var(--orcha-text-muted)" } }}>
                  Database: Unknown / Deleted
                </Badge>
              )}
              {filterRules && filterRules.length > 0 ? (
                filterRules.map((rule, idx) => {
                  let label = "";
                  if (rule.type === "between") {
                    label = `${rule.column}: ${rule.dateFrom} to ${rule.dateTo}`;
                  } else if (rule.type === "month_year") {
                    const mName = MONTH_OPTIONS.find(o => o.value === rule.month)?.label || rule.month;
                    label = `${rule.column}: ${mName} ${rule.year}`;
                  } else if (rule.type === "year") {
                    label = `${rule.column}: Year ${rule.year}`;
                  } else if (rule.type === "month") {
                    const mName = MONTH_OPTIONS.find(o => o.value === rule.month)?.label || rule.month;
                    label = `${rule.column}: ${mName}`;
                  }
                  return (
                    <Badge key={rule.id || idx} variant="light" color="orange" size="sm" styles={{ label: { textTransform: "none" } }}>
                      Filtered: {label}
                    </Badge>
                  );
                })
              ) : entry.filterDateColumn ? (
                <Badge variant="light" color="orange" size="sm" styles={{ label: { textTransform: "none" } }}>
                  Filtered: {entry.filterDateColumn} ({entry.filterDateFrom} to {entry.filterDateTo})
                </Badge>
              ) : null}
              <Text size="xs" c="dimmed" style={{ borderLeft: "1px solid var(--orcha-border)", paddingLeft: "10px" }}>
                Saved on {(() => {
                  const d = new Date(entry.createdAt);
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  return `${mm}/${dd}/${d.getFullYear()}`;
                })()}
              </Text>
            </Group>
          </Box>
          <Menu shadow="md" width={180} position="bottom-end" styles={{
            dropdown: { background: "var(--orcha-panel)", borderColor: "var(--orcha-border)" },
            item: { color: "var(--orcha-text-title)", transition: "all 0.2s ease" }
          }}>
            <Menu.Target>
              <ActionIcon variant="light" color="violet" size="lg" radius="md">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Actions</Menu.Label>
              <Menu.Item 
                leftSection={refreshing ? <Loader size={12} color="violet" /> : <IconRefresh size={14} color="#a855f7" />} 
                onClick={handleRefresh}
                disabled={refreshing || !dbConfig}
              >
                Sync with Database
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconFilter size={14} color="#a855f7" />} 
                onClick={() => setFilterModalOpen(true)}
                disabled={refreshing || !dbConfig}
              >
                Configure Filters
              </Menu.Item>
              {((filterRules && filterRules.length > 0) || entry.filterDateColumn) && (
                <Menu.Item 
                  leftSection={<IconFilter size={14} color="#ef4444" />} 
                  onClick={() => handleClearFilter()}
                  disabled={refreshing}
                  c="red.4"
                >
                  Clear Filters
                </Menu.Item>
              )}
              <Menu.Item 
                leftSection={<IconPencil size={14} color="#a855f7" />} 
                onClick={startRename}
                disabled={refreshing}
              >
                Rename
              </Menu.Item>
              <Menu.Item leftSection={<IconTerminal2 size={14} color="#a855f7" />} onClick={() => setSqlModalOpen(true)}>
                View SQL Query
              </Menu.Item>
              <Menu.Divider style={{ borderColor: "var(--orcha-border)" }} />
              <Menu.Item 
                leftSection={<IconTrash size={14} color="#ef4444" />} 
                onClick={() => setDeleteModalOpen(true)}
                c="red.4"
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* 1. Live Query Results Table (Top) */}
        <Box>
          <Text size="xs" fw={700} c="violet.4" mb="md" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Live Query Result
          </Text>
          <Box style={{ position: "relative" }}>
            {pageData ? (
              <DataTable
                data={pageData}
                sql={entry.sql}
              />
            ) : (
              <Box style={{ background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", borderRadius: 14, height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Stack align="center" gap="xs">
                  <Loader color="violet" size="sm" />
                  <Text size="xs" c="violet.3" fw={600}>Executing database query...</Text>
                </Stack>
              </Box>
            )}

            {loadingPage && pageData && (
              <Box
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "var(--orcha-panel)",
                  opacity: 0.85,
                  backdropFilter: "blur(2px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  borderRadius: 14,
                }}
              >
                <Stack align="center" gap="xs">
                  <Loader color="violet" size="sm" />
                  <Text size="xs" c="violet.3" fw={600}>Executing SQL query...</Text>
                </Stack>
              </Box>
            )}
          </Box>

          {/* Pagination Controls */}
          {pageData && (
            <PaginationControls
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              loadingPage={loadingPage}
              onPageChange={setCurrentPage}
            />
          )}
        </Box>

        {/* 2. Chat/Conversation History (Bottom) */}
        <Box style={{ background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", borderRadius: 12, padding: "24px" }}>
          <Text size="xs" fw={700} c="violet.4" mb="md" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Conversation Transcript
          </Text>
          <ConversationTranscript chatHistoryRaw={entry.chatHistory} />
        </Box>

        {/* Extracted Sql Query Drawer */}
        <SqlQueryDrawer
          opened={sqlModalOpen}
          onClose={() => setSqlModalOpen(false)}
          sql={entry.sql}
        />

        {/* Extracted Filter Drawer */}
        <FilterDrawer
          opened={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          columns={dateColumns}
          activeFilterRules={filterRules}
          onApply={(newRules) => handleApplyFilter(newRules, () => setFilterModalOpen(false))}
          onClear={() => handleClearFilter(() => setFilterModalOpen(false))}
          refreshing={refreshing}
        />

        {/* Extracted Delete Confirmation Modal */}
        <DeleteConfirmModal
          opened={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={() => handleDelete(() => setDeleteModalOpen(false))}
          loading={refreshing}
        />
      </Stack>
    </Box>
  );
}
