"use client";

import {
  Title,
  Text,
  Stack,
  Tabs,
  Divider,
  Box
} from "@mantine/core";
import {
  IconUser,
  IconBuildingSkyscraper,
  IconShieldLock,
  IconSparkles
} from "@tabler/icons-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// Sub-components
import { AccountTab } from "@/components/UserSettings/AccountTab";
import { OrganizationTab } from "@/components/UserSettings/OrganizationTab";
import { AIIntelligenceTab } from "@/components/UserSettings/AIIntelligenceTab";
import { SecurityTab } from "@/components/UserSettings/SecurityTab";

export default function SettingsPage() {
  const { saas } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();

  // Read active tab from URL or default to 'account'
  const activeTabFromUrl = searchParams.get("tab") || "account";
  const [activeTab, setActiveTab] = useState<string | null>(activeTabFromUrl);

  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const syncMembership = useMutation(api.memberships.syncMembership);

  // Sync state with URL if it changes externally
  useEffect(() => {
    setActiveTab(activeTabFromUrl);
  }, [activeTabFromUrl]);

  // JIT Sync: Ensure the current user has a membership record in Convex for this org
  useEffect(() => {
    if (activeOrg?._id && isSignedIn) {
      syncMembership({ organizationId: activeOrg._id }).catch(console.error);
    }
  }, [activeOrg?._id, isSignedIn, syncMembership]);

  const handleTabChange = (value: string | null) => {
    if (value) {
      setActiveTab(value);
      router.replace(`/${saas}/settings?tab=${value}`);
    }
  };

  return (
    <Box py="4rem" px="3rem">
      <title>Profile Settings</title>
      <Stack gap="xl">
        <Box>
          <Title order={1} size="2.5rem" mb="xs">Settings</Title>
          <Text c="dimmed">Manage your account, organization, and agent preferences.</Text>
        </Box>

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="pills"
          orientation="vertical"
          color="violet"
          styles={{
            root: { flex: 1, gap: "3rem" },
            list: {
              width: 240,
              borderLeft: "none",
              borderRight: "1px solid rgba(255,255,255,0.05)",
              paddingLeft: 0,
              paddingRight: "2rem",
              background: "transparent"
            },
            tab: {
              color: "rgba(255,255,255,0.4)",
              padding: "0.8rem 1.2rem",
              justifyContent: "flex-start",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "8px",
            },
            panel: { flex: 1 }
          }}
        >
          {/* Left Sidebar List */}
          <Tabs.List>
            <Text size="10px" fw={700} c="dimmed" mb="md" mt="xs" style={{ letterSpacing: "1px", textTransform: "uppercase" }}>Preferences</Text>
            <Tabs.Tab value="account" leftSection={<IconUser size={16} />}>Account</Tabs.Tab>
            <Tabs.Tab value="organization" leftSection={<IconBuildingSkyscraper size={16} />}>Organization</Tabs.Tab>
            <Tabs.Tab value="ai" leftSection={<IconSparkles size={16} />}>AI Intelligence</Tabs.Tab>
            <Tabs.Tab value="security" leftSection={<IconShieldLock size={16} />}>Security</Tabs.Tab>

            <Divider color="rgba(255,255,255,0.05)" my="xl" />

            <Text size="11px" c="dimmed" px="xs">Need help? <Text span c="violet.4" style={{ cursor: "pointer" }}>View Documentation</Text></Text>
          </Tabs.List>

          {/* Main Content Area */}
          <Box style={{ flex: 1 }}>
            <Tabs.Panel value="account">
              <AccountTab />
            </Tabs.Panel>

            <Tabs.Panel value="organization">
              <OrganizationTab />
            </Tabs.Panel>

            <Tabs.Panel value="ai">
              <AIIntelligenceTab organization={activeOrg} />
            </Tabs.Panel>

            <Tabs.Panel value="security">
              <SecurityTab />
            </Tabs.Panel>
          </Box>
        </Tabs>
      </Stack>
    </Box>
  );
}
