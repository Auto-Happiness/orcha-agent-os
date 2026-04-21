"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Box, Stack, Text, Group, Button, ActionIcon, Tooltip, Paper, Title, Loader, Center, Modal } from "@mantine/core";
import { IconPlus, IconTableFilled, IconTrash, IconPencil, IconArrowRight, IconAlertTriangle } from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { notifications } from "@mantine/notifications";

export default function SpreadsheetListPage() {
  const { saas } = useParams();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });

  const spreadsheets = useQuery(
    api.spreadsheets.listByOrganization,
    activeOrg?._id && isSignedIn ? { organizationId: activeOrg._id } : "skip"
  );

  const createSpreadsheet = useMutation(api.spreadsheets.create);
  const removeSpreadsheet = useMutation(api.spreadsheets.remove);
  const renameSpreadsheet = useMutation(api.spreadsheets.rename);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!activeOrg?._id) return;
    const id = await createSpreadsheet({ organizationId: activeOrg._id, name: "Untitled Spreadsheet" });
    router.push(`/${saas}/spreadsheet/${id}`);
  }, [activeOrg?._id, createSpreadsheet, router, saas]);

  const handleOpen = (id: string) => router.push(`/${saas}/spreadsheet/${id}`);

  const handleRename = async (id: string) => {
    if (renameValue.trim()) await renameSpreadsheet({ spreadsheetId: id as Id<"spreadsheets">, name: renameValue.trim() });
    setRenamingId(null);
  };

  if (!isSignedIn || activeOrg === undefined || (activeOrg?._id && spreadsheets === undefined)) {
    return <Center h="60vh"><Loader color="violet" /></Center>;
  }

  return (
    <Box p="xl">
      <title>Reports</title>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Group gap="xs" mb={4}>
              <IconTableFilled size={16} color="#a855f7" />
              <Text size="xs" fw={700} c="violet.4" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Spreadsheets</Text>
            </Group>
            <Title order={1} c="white">Reports & Spreadsheets</Title>
            <Text c="dimmed" size="sm" mt={4}>Create and manage spreadsheets shared across your organization.</Text>
          </Box>
          <Button leftSection={<IconPlus size={16} />} color="violet" radius="md" onClick={handleCreate}>
            New Spreadsheet
          </Button>
        </Group>

        {(spreadsheets ?? []).length === 0 ? (
          <Paper p="xl" radius="lg" style={{ background: "rgba(255,255,255,0.02)", border: "2px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
            <IconTableFilled size={40} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 12px" }} />
            <Text c="dimmed" size="sm">No spreadsheets yet. Create one to get started.</Text>
            <Button mt="md" variant="light" color="violet" radius="md" leftSection={<IconPlus size={14} />} onClick={handleCreate}>
              Create Spreadsheet
            </Button>
          </Paper>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {(spreadsheets ?? []).map(s => (
              <Paper
                key={s._id}
                p="lg"
                radius="md"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(147,51,234,0.3)"; (e.currentTarget as HTMLElement).style.background = "rgba(147,51,234,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                onClick={() => handleOpen(s._id)}
              >
                <Group justify="space-between" mb="sm">
                  <IconTableFilled size={24} color="#a855f7" />
                  <Group gap={4} onClick={e => e.stopPropagation()}>
                    <Tooltip label="Rename" withArrow>
                      <ActionIcon size="sm" variant="subtle" color="dimmed" onClick={() => { setRenamingId(s._id); setRenameValue(s.name); }}>
                        <IconPencil size={13} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete" withArrow>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setDeletingId(s._id)}>
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                {renamingId === s._id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(s._id)}
                    onKeyDown={e => { if (e.key === "Enter") handleRename(s._id); if (e.key === "Escape") setRenamingId(null); e.stopPropagation(); }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(147,51,234,0.3)", borderRadius: 4, padding: "4px 8px", color: "white", fontSize: 14, outline: "none" }}
                  />
                ) : (
                  <Text fw={600} c="white" size="sm" truncate>{s.name}</Text>
                )}

                <Text size="11px" c="dimmed" mt={4}>
                  {s.sheets.length} sheet{s.sheets.length !== 1 ? "s" : ""} · Updated {new Date(s.updatedAt).toLocaleDateString()}
                </Text>

                <Group justify="flex-end" mt="md">
                  <Button size="compact-xs" variant="subtle" color="violet" rightSection={<IconArrowRight size={12} />} onClick={() => handleOpen(s._id)}>
                    Open
                  </Button>
                </Group>
              </Paper>
            ))}
          </div>
        )}
      </Stack>

      <Modal
        opened={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Report"
        centered
        size="sm"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        styles={{
          content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 12 },
          header: { background: "#130f22", color: "white" },
          title: { fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="rgba(255,255,255,0.7)">
            Are you sure you want to delete this report? This action cannot be undone and will remove all associated data.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setDeletingId(null)} size="xs">
              Cancel
            </Button>
            <Button color="red" onClick={async () => {
              if (deletingId) {
                await removeSpreadsheet({ spreadsheetId: deletingId as Id<"spreadsheets"> });
                setDeletingId(null);
                notifications.show({ title: "Report Deleted", message: "The report has been permanently removed.", color: "red" });
              }
            }} size="xs">
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
