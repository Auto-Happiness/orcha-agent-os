"use client";

import { useState } from "react";
import { 
  Stack, 
  Paper, 
  Group, 
  Title, 
  Text, 
  Badge, 
  TextInput, 
  Select, 
  Button,
  Avatar,
  Table,
  ActionIcon,
  Tooltip,
  Modal,
  Loader,
  Center
} from "@mantine/core";
import { useOrganization, useUser } from "@clerk/nextjs";
import { 
  IconTrash, 
  IconUserPlus, 
  IconUsers, 
  IconMail, 
  IconBuildingSkyscraper, 
  IconAlertCircle,
  IconCheck
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { inputStyles } from "@/lib/styles";

// Custom high-contrast styles for larger and lighter inputs
const largeInputStyles = {
  ...inputStyles,
  label: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "10px",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(168, 85, 247, 0.35)",
    color: "white",
    height: "50px",
    fontSize: "15px",
    borderRadius: "10px",
  }
};

export function OrganizationTab() {
  const { user } = useUser();
  const { 
    organization, 
    memberships, 
    invitations, 
    membership 
  } = useOrganization({
    memberships: true,
    invitations: true,
  });

  const [orgName, setOrgName] = useState(organization?.name || "");
  const [updatingName, setUpdatingName] = useState(false);
  const [inviteModalOpened, setInviteModalOpened] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("org:member");
  const [sendingInvite, setSendingInvite] = useState(false);

  const isAdmin = membership?.role === "org:admin";

  const handleUpdateOrg = async () => {
    if (!organization || !orgName.trim()) return;
    setUpdatingName(true);
    try {
      await organization.update({ name: orgName.trim() });
      notifications.show({
        title: "Success",
        message: "Organization name updated successfully.",
        color: "green",
        icon: <IconCheck size={16} />
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to update organization.",
        color: "red",
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setUpdatingName(false);
    }
  };

  const handleSendInvite = async () => {
    if (!organization || !inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      await organization.inviteMember({
        emailAddress: inviteEmail.trim(),
        role: inviteRole as "org:admin" | "org:member"
      });
      notifications.show({
        title: "Invitation Sent",
        message: `Successfully invited ${inviteEmail} as an ${inviteRole === "org:admin" ? "Admin" : "Member"}.`,
        color: "green",
        icon: <IconCheck size={16} />
      });
      setInviteEmail("");
      setInviteModalOpened(false);
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to send invitation.",
        color: "red",
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inv: any) => {
    try {
      await inv.revoke();
      notifications.show({
        title: "Revoked",
        message: "Invitation has been successfully revoked.",
        color: "blue",
        icon: <IconCheck size={16} />
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to revoke invitation.",
        color: "red",
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const handleRemoveMember = async (mem: any) => {
    if (!confirm(`Are you sure you want to remove ${mem.publicUserData.identifier} from this organization?`)) return;
    try {
      await mem.destroy();
      notifications.show({
        title: "Removed",
        message: "Member removed from organization.",
        color: "blue",
        icon: <IconCheck size={16} />
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to remove member.",
        color: "red",
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const handleChangeRole = async (mem: any, newRole: string) => {
    try {
      await mem.update({ role: newRole as "org:admin" | "org:member" });
      notifications.show({
        title: "Role Updated",
        message: `Role changed to ${newRole === "org:admin" ? "Admin" : "Member"}.`,
        color: "green",
        icon: <IconCheck size={16} />
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to update role.",
        color: "red",
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  if (!organization) {
    return (
      <Paper withBorder p="3rem" radius="xl" style={{ background: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(168, 85, 247, 0.25)" }}>
        <Center style={{ height: "250px" }}>
          <Stack align="center" gap="md">
            <IconBuildingSkyscraper size={56} color="rgba(168, 85, 247, 0.45)" />
            <Text c="white" fw={700} size="lg">No active organization selected</Text>
            <Text size="sm" c="rgba(255, 255, 255, 0.65)" ta="center" maw={450}>Please select or create a Clerk organization to manage its settings.</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Stack gap="2.5rem">
      {/* ── Section 1: Org Settings ────────────────────────────────────── */}
      <Paper withBorder p="3rem" radius="xl" style={{ background: "rgba(255, 255, 255, 0.04)", borderColor: "rgba(168, 85, 247, 0.25)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)" }}>
        <Stack gap="2rem">
          <Group gap="md">
            <IconBuildingSkyscraper size={28} color="#a855f7" />
            <Title order={3} size="1.8rem" c="white" style={{ letterSpacing: "-0.02em" }}>{organization.name}</Title>
          </Group>

          <Stack gap="xl">
            <TextInput 
              label="Organization Name" 
              value={orgName} 
              onChange={(e) => setOrgName(e.target.value)} 
              styles={largeInputStyles} 
              disabled={!isAdmin}
            />
          </Stack>

          {isAdmin && (
            <Group justify="flex-end" mt="md">
              <Button 
                onClick={handleUpdateOrg} 
                loading={updatingName} 
                color="violet" 
                radius="md" 
                size="md"
                style={{
                  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                  boxShadow: "0 4px 20px rgba(168, 85, 247, 0.4)",
                  height: "46px",
                  padding: "0 2rem",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                Update Organization
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* ── Section 2: Org Members ────────────────────────────────────── */}
      <Paper withBorder p="3rem" radius="xl" style={{ background: "rgba(255, 255, 255, 0.04)", borderColor: "rgba(168, 85, 247, 0.25)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)" }}>
        <Stack gap="xl">
          <Group justify="space-between">
            <Group gap="sm">
              <IconUsers size={24} color="#a855f7" />
              <Title order={4} size="1.4rem" c="white" style={{ letterSpacing: "-0.01em" }}>Members</Title>
              {memberships?.data && (
                <Badge variant="light" color="violet" size="md" style={{ fontSize: "12px", height: "24px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{memberships.data.length}</Badge>
              )}
            </Group>

            {isAdmin && (
              <Button 
                leftSection={<IconUserPlus size={18} />} 
                onClick={() => setInviteModalOpened(true)}
                color="violet"
                variant="light"
                radius="md"
                size="md"
                style={{ height: "42px" }}
              >
                Invite Member
              </Button>
            )}
          </Group>

          {memberships?.isLoading ? (
            <Center py="3rem">
              <Loader color="violet" size="md" />
            </Center>
          ) : (
            <Table variant="unstyled" style={{ color: "white" }}>
              <Table.Thead style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", height: "45px" }}>
                <Table.Tr>
                  <Table.Th style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>User</Table.Th>
                  <Table.Th style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>Email</Table.Th>
                  <Table.Th style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>Role</Table.Th>
                  {isAdmin && <Table.Th style={{ textAlign: "right", color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {memberships?.data?.map((m) => {
                  if (!m.publicUserData) return null;
                  const isSelf = m.publicUserData.userId === user?.id;
                  return (
                    <Table.Tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <Table.Td py="md">
                        <Group gap="sm">
                          <Avatar src={m.publicUserData.imageUrl} radius="xl" size="md" />
                          <Text size="md" fw={600} c="white">
                            {m.publicUserData.firstName} {m.publicUserData.lastName}
                            {isSelf && <Text span size="11px" c="violet.3" ml="xs" style={{ background: "rgba(168, 85, 247, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>(You)</Text>}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td py="md">
                        <Text size="md" c="rgba(255,255,255,0.65)">{m.publicUserData.identifier}</Text>
                      </Table.Td>
                      <Table.Td py="md">
                        {isAdmin && !isSelf ? (
                          <Select
                            value={m.role}
                            onChange={(val) => val && handleChangeRole(m, val)}
                            data={[
                              { value: "org:member", label: "Member" },
                              { value: "org:admin", label: "Admin" }
                            ]}
                            variant="unstyled"
                            size="sm"
                            styles={{
                              input: { color: "#b07bf0", fontWeight: 700, fontSize: "14px", height: "36px" },
                              dropdown: { background: "#0c0a1a", borderColor: "rgba(168, 85, 247, 0.35)", borderRadius: "8px" },
                              option: { color: "white", fontSize: "13px", padding: "8px 12px" }
                            }}
                          />
                        ) : (
                          <Badge color={m.role === "org:admin" ? "violet" : "gray"} variant="light" size="md" tt="none" style={{ fontSize: "12px", height: "22px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            {m.role === "org:admin" ? "Admin" : "Member"}
                          </Badge>
                        )}
                      </Table.Td>
                      {isAdmin && (
                        <Table.Td py="md" style={{ textAlign: "right" }}>
                          {!isSelf && (
                            <Tooltip label="Remove from organization">
                              <ActionIcon 
                                color="red" 
                                variant="subtle" 
                                size="md"
                                onClick={() => handleRemoveMember(m)}
                              >
                                <IconTrash size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      {/* ── Section 3: Pending Invitations ────────────────────────────────── */}
      {invitations?.data && invitations.data.length > 0 && (
        <Paper withBorder p="3rem" radius="xl" style={{ background: "rgba(255, 255, 255, 0.04)", borderColor: "rgba(168, 85, 247, 0.25)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)" }}>
          <Stack gap="xl">
            <Group gap="sm">
              <IconMail size={24} color="#a855f7" />
              <Title order={4} size="1.4rem" c="white" style={{ letterSpacing: "-0.01em" }}>Pending Invitations</Title>
              <Badge variant="light" color="orange" size="md" style={{ fontSize: "12px", height: "24px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{invitations.data.length}</Badge>
            </Group>

            <Table variant="unstyled" style={{ color: "white" }}>
              <Table.Thead style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", height: "45px" }}>
                <Table.Tr>
                  <Table.Th style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>Invited Email</Table.Th>
                  <Table.Th style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>Role</Table.Th>
                  {isAdmin && <Table.Th style={{ textAlign: "right", color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "14px" }}>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invitations.data.map((inv) => (
                  <Table.Tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <Table.Td py="md">
                      <Text size="md" fw={600} c="white">{inv.emailAddress}</Text>
                    </Table.Td>
                    <Table.Td py="md">
                      <Badge color={inv.role === "org:admin" ? "violet" : "gray"} variant="light" size="md" tt="none" style={{ fontSize: "12px", height: "22px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        {inv.role === "org:admin" ? "Admin" : "Member"}
                      </Badge>
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td py="md" style={{ textAlign: "right" }}>
                        <Tooltip label="Revoke Invitation">
                          <ActionIcon 
                            color="orange" 
                            variant="subtle" 
                            size="md"
                            onClick={() => handleRevokeInvite(inv)}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      )}

      {/* ── Invite Member Modal ────────────────────────────────────────── */}
      <Modal
        opened={inviteModalOpened}
        onClose={() => setInviteModalOpened(false)}
        title={
          <Group gap="xs">
            <IconUserPlus size={24} color="#a855f7" />
            <Text fw={800} size="lg" c="white" style={{ letterSpacing: "-0.01em" }}>Invite New Member</Text>
          </Group>
        }
        centered
        styles={{
          content: { background: "#130f22", border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: "16px", padding: "1.5rem" },
          header: { background: "#130f22", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "15px" },
        }}
      >
        <Stack gap="2rem" pt="md">
          <Text size="md" c="rgba(255,255,255,0.65)" style={{ lineHeight: 1.5 }}>
            Send an email invitation to invite a user to join this organization.
          </Text>

          <Stack gap="xl">
            <TextInput
              label="Email Address"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              styles={largeInputStyles}
            />

            <Select
              label="Role"
              value={inviteRole}
              onChange={(val) => val && setInviteRole(val)}
              data={[
                { value: "org:member", label: "Member (Can query and run tools)" },
                { value: "org:admin", label: "Admin (Full administration rights)" }
              ]}
              styles={largeInputStyles}
            />
          </Stack>

          <Group justify="flex-end" gap="md" mt="md">
            <Button variant="subtle" color="gray" size="md" onClick={() => setInviteModalOpened(false)} style={{ height: "46px" }}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvite}
              loading={sendingInvite}
              disabled={!inviteEmail.trim()}
              color="violet"
              size="md"
              style={{
                background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                boxShadow: "0 4px 20px rgba(168, 85, 247, 0.4)",
                height: "46px",
                padding: "0 2rem"
              }}
            >
              Send Invitation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
