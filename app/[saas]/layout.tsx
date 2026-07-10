"use client";

import { ReactNode, useState, useMemo, useEffect, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Stack,
  Text,
  Avatar,
  Menu,
  Divider,
  Badge,
  Tooltip,
  ScrollArea,
  Box,
  ActionIcon,
  Kbd,
  Center,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useUser, useOrganization, useOrganizationList, SignOutButton } from "@clerk/nextjs";
import {
  IconRobot,
  IconAdjustments,
  IconBuildingStore,
  IconSparkles,
  IconBell,
  IconSearch,
  IconChevronDown,
  IconLogout,
  IconUserCircle,
  IconBuildingSkyscraper,
  IconHelpCircle,
  IconPointFilled,
  IconSettings,
  IconChartBar,
  IconLayoutDashboard,
  IconTool,
  IconNotebook,
} from "@tabler/icons-react";
import { MantineUiProvider } from "@/lib/mantine-provider";
import { Spotlight, spotlight } from "@mantine/spotlight";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ─── Brand logo ─────────────────────────────────────────────────────────── */

function OrchaLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Box style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src="/graphics/orca ai 2.png"
          alt="Orcha Logo"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </Box>
      {!collapsed && (
        <Box>
          <Text fw={700} size="sm" c="var(--orcha-text-title)" lh={1}>Orcha</Text>
          <Text size="9px" c="violet.3" fw={600} style={{ letterSpacing: "0.15em" }}>AGENT OS</Text>
        </Box>
      )}
    </Group>
  );
}

/* ─── Navigation definition ──────────────────────────────────────────────── */

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { href: "chat", label: "Chat", icon: IconSparkles, badges: [] },
      { href: "configure", label: "Configure", icon: IconAdjustments, badges: [] },
      { href: "command-center", label: "Command Center", icon: IconLayoutDashboard, badges: [] },
      {
        href: "databook",
        label: "Databook",
        icon: IconNotebook,
        badges: [
          { label: "New", color: "blue" },
          { label: "Beta", color: "orange" },
        ],
      },
    ],
  },

  {
    label: "Tools",
    items: [
      { href: "marketplace", label: "Market Place", icon: IconBuildingStore, badges: [] },
      { href: "marketplace/custom", label: "Custom Tools", icon: IconTool, badges: [] },
      { href: "developers", label: "Developers", icon: IconSettings, badges: [] },
    ],
  },
];

/* ─── Sidebar nav item ───────────────────────────────────────────────────── */

function SideNavItem({
  href,
  label,
  icon: Icon,
  badges,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badges?: { label: string; color?: string }[];
  active: boolean;
  collapsed: boolean;
}) {
  const item = (
    <NavLink
      component={Link}
      href={href}
      label={collapsed ? undefined : label}
      leftSection={<Icon size={18} stroke={1.6} />}
      rightSection={
        !collapsed && badges && badges.length > 0 ? (
          <Group gap={4} wrap="nowrap">
            {badges.map((b, idx) => (
              <Badge 
                key={idx}
                variant="light" 
                color={b.color || "violet"} 
                radius="sm" 
                tt="none"
                style={{
                  height: "20px",
                  lineHeight: "1",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                  fontSize: "10px",
                  fontWeight: 600
                }}
              >
                {b.label}
              </Badge>
            ))}
          </Group>
        ) : null
      }
      active={active}
      styles={{
        root: {
          borderRadius: "8px",
          padding: "9px 10px",
          color: active ? "var(--orcha-purple)" : "var(--orcha-sidebar-text)",
          backgroundColor: active ? "var(--orcha-sidebar-hover-bg)" : "transparent",
          "&:hover": {
            backgroundColor: "var(--orcha-sidebar-hover-bg)",
            color: "var(--orcha-sidebar-hover-text)",
          },
        },
        label: { fontSize: "13px", fontWeight: 500 },
      }}
    />
  );

  if (collapsed) {
    return (
      <Tooltip label={label} position="right" withArrow>
        {item}
      </Tooltip>
    );
  }

  return item;
}

/* ─── Layout ──────────────────────────────────────────────────────────────── */

export default function SaasLayout({ children }: { children: ReactNode }) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [collapsed, setCollapsed] = useState(false);

  const params = useParams<{ saas: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true
    }
  });
  const syncMembership = useMutation(api.memberships.syncMembership);
  const upsertOrg = useMutation(api.organizations.upsertFromClerk);
  const { isAuthenticated } = useConvexAuth();

  const slug = params?.saas ?? "";

  // ─── Automatic Organization Synchronization ──────────────────────
  // Sync Clerk's active organization to match the URL slug if they differ.
  useEffect(() => {
    if (orgLoaded && userMemberships?.data && setActive) {
      if (organization?.slug !== slug && organization?.id !== slug) {
        const target = userMemberships.data.find(m => m.organization.slug === slug || m.organization.id === slug);
        if (target) {
          console.log("[Layout Sync] Auto-switching Clerk organization to match URL slug:", slug);
          setActive({ organization: target.organization.id });
        }
      }
    }
  }, [slug, organization, orgLoaded, userMemberships?.data, setActive]);

  // ─── Search implementation ──────────────────────────────────────────
  const orgDoc = useQuery(api.organizations.getSafeBySlug, slug ? { slug } : "skip");
  const isMember = useQuery(api.memberships.checkMembershipStatus, orgDoc?._id && user ? { organizationId: orgDoc._id } : "skip");
  const dbConfigs = useQuery(
    api.databaseConfigs.listByOrganization,
    orgDoc?._id && user ? { organizationId: orgDoc._id } : "skip"
  );
  const databookEntries = useQuery(
    api.databook.listByOrg,
    orgDoc?._id && user ? { organizationId: orgDoc._id } : "skip"
  );

  // Developer Diagnostics
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Layout Sync] Status:", {
        clerkUser: userLoaded ? "Ready" : "Waiting",
        clerkOrg: orgLoaded ? "Ready" : "Waiting",
        convexOrgDoc: orgDoc === undefined ? "Loading" : orgDoc === null ? "Not Found" : "Ready",
        membership: isMember === undefined ? "Loading" : isMember === true ? "Verified" : "Syncing Needed",
        slug
      });
    }
  }, [userLoaded, orgLoaded, orgDoc, isMember, slug]);

  const spotlightActions = useMemo(() => {
    const configActions = (dbConfigs || []).map((config) => ({
      id: config._id,
      label: config.name,
      description: `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Environment`,
      onClick: () => router.push(`/${slug}/configure/${config._id}`),
      leftSection: (
        <Box
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(147,51,234,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <IconAdjustments size={16} color="#a855f7" />
        </Box>
      ),
    }));

    const databookActions = (databookEntries || []).map((entry) => ({
      id: entry._id,
      label: entry.name,
      description: `Saved Query: "${entry.question}"`,
      onClick: () => router.push(`/${slug}/databook/${entry._id}`),
      leftSection: (
        <Box
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(124,58,237,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <IconNotebook size={16} color="#7c3aed" />
        </Box>
      ),
    }));

    return [...configActions, ...databookActions];
  }, [dbConfigs, databookEntries, router, slug]);

  const [isSyncingOrg, setIsSyncingOrg] = useState(false);
  const [isSyncingMembership, setIsSyncingMembership] = useState(false);
  const syncedOrgsRef = useRef<Set<string>>(new Set());
  const syncedMembershipsRef = useRef<Set<string>>(new Set());

  const JITSourcedOrgKey = `${slug}|${organization?.id || ""}`;
  const JITSourcedMembershipKey = `${orgDoc?._id || ""}|${user?.id || ""}`;



  // 1. Sync Organization if it exists in Clerk but not Convex
  useEffect(() => {
    if (
      orgDoc === null &&
      !!organization &&
      orgLoaded &&
      isAuthenticated &&
      !isSyncingOrg &&
      !syncedOrgsRef.current.has(JITSourcedOrgKey)
    ) {
      syncedOrgsRef.current.add(JITSourcedOrgKey);
      setIsSyncingOrg(true);
      console.log("[Layout Sync] Triggering JIT Org Sync for:", organization.slug);
      upsertOrg({
        clerkOrgId: organization.id,
        name: organization.name,
        slug: organization.slug || organization.id,
      })
        .catch((err) => {
          console.error("[Layout Sync] Org sync failed:", err);
          syncedOrgsRef.current.delete(JITSourcedOrgKey);
        })
        .finally(() => setIsSyncingOrg(false));
    }
  }, [orgDoc, organization, orgLoaded, isAuthenticated, JITSourcedOrgKey]);

  // 2. Sync Membership if user is in Clerk org but not Convex membership
  useEffect(() => {
    if (
      isMember === false &&
      !!orgDoc?._id &&
      userLoaded &&
      orgLoaded &&
      isAuthenticated &&
      !isSyncingMembership &&
      !syncedMembershipsRef.current.has(JITSourcedMembershipKey)
    ) {
      syncedMembershipsRef.current.add(JITSourcedMembershipKey);
      setIsSyncingMembership(true);
      console.log("[Layout Sync] Triggering JIT Membership Sync for org:", orgDoc._id);
      syncMembership({ organizationId: orgDoc._id })
        .catch((err) => {
          console.error("[Layout Sync] Membership sync failed:", err);
          syncedMembershipsRef.current.delete(JITSourcedMembershipKey);
        })
        .finally(() => setIsSyncingMembership(false));
    }
  }, [isMember, orgDoc?._id, userLoaded, orgLoaded, isAuthenticated, JITSourcedMembershipKey]);

  const isSyncing = isSyncingOrg || isSyncingMembership;

  // Can safely render children if we confirmed they are a member,
  // or if the workspace doesn't exist (let children handle 404)
  const canRenderChildren =
    (isMember === true || (orgDoc === null && organization === null && orgLoaded)) &&
    !isSyncing;

  function isActive(href: string) {
    const target = `/${slug}/${href}`;
    if (href === "marketplace") return pathname === target;
    return pathname === target || pathname.startsWith(`${target}/`);
  }

  const SIDEBAR_W = collapsed ? 70 : 240;
  const BG_SIDEBAR = "var(--sidebar)";
  const BG_PAGE = "var(--background)";
  const BORDER_COL = "var(--orcha-border)";

  return (
    <MantineUiProvider>
      <AppShell
        layout="default"
        navbar={{
          width: SIDEBAR_W,
          breakpoint: "sm",
          collapsed: { mobile: !mobileOpened },
        }}
        header={{ height: 56 }}
        styles={{
          root: { background: BG_PAGE, minHeight: "100vh" },
          navbar: {
            background: BG_SIDEBAR,
            borderRight: `1px solid ${BORDER_COL}`,
            transition: "width 200ms ease",
          },
          header: {
            background: "var(--orcha-header-bg)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${BORDER_COL}`,
          },
          main: { background: BG_PAGE, color: "var(--foreground)" },
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            {/* Left */}
            <Group gap="sm">
              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
                color="var(--orcha-text-muted)"
              />
              {/* Search hint */}
              <Group
                gap={6}
                px="sm"
                py={5}
                onClick={spotlight.open}
                style={{
                  background: "var(--orcha-surface)",
                  border: "1px solid var(--orcha-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  minWidth: 220,
                  transition: "all 0.2s ease"
                }}
                className="hover:bg-black/5 dark:hover:bg-white/10"
                visibleFrom="sm"
              >
                <IconSearch size={14} color="var(--orcha-text-muted)" />
                <Text size="xs" c="dimmed" style={{ flex: 1 }}>Search configurations…</Text>
                <Kbd size="xs" style={{ background: "var(--orcha-bg)", border: "none", color: "var(--orcha-text-muted)" }}>⌘K</Kbd>
              </Group>
            </Group>

            {/* Right */}
            <Group gap="xs">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Notifications */}
              <Tooltip label="Notifications" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  style={{ color: "var(--orcha-text-muted)", position: "relative" }}
                >
                  <IconBell size={18} />
                  {/* Dot indicator */}
                  <Box
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--orcha-purple)",
                      border: "2px solid var(--orcha-bg)",
                    }}
                  />
                </ActionIcon>
              </Tooltip>

              {/* User menu */}
              <Menu shadow="md" width={200} offset={8}>
                <Menu.Target>
                  <Group
                    gap="xs"
                    px="xs"
                    py={4}
                    style={{
                      background: "var(--orcha-surface)",
                      border: "1px solid var(--orcha-border)",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <Avatar
                      src={user?.imageUrl}
                      name={user?.fullName ?? ""}
                      size={26}
                      radius="xl"
                      color="violet"
                    />
                    <Text size="xs" c="var(--orcha-text-body)" fw={500} visibleFrom="sm">
                      {user?.firstName}
                    </Text>
                    <IconChevronDown size={12} color="var(--orcha-text-muted)" />
                  </Group>
                </Menu.Target>

                <Menu.Dropdown
                  style={{
                    background: "var(--orcha-panel)",
                    border: "1px solid var(--orcha-border)",
                    borderRadius: "10px",
                  }}
                >
                  <Menu.Label c="dimmed" >
                    {user?.primaryEmailAddress?.emailAddress}
                  </Menu.Label>
                  <Menu.Item
                    component={Link}
                    href={`/${slug}/settings`}
                    leftSection={<IconSettings size={15} />}
                    c="var(--orcha-text-body)"
                  >
                    Settings
                  </Menu.Item>
                  <Menu.Divider style={{ borderColor: "var(--orcha-border)" }} />
                  <Menu.Item leftSection={<IconHelpCircle size={15} />} c="var(--orcha-text-body)">
                    Help & Docs
                  </Menu.Item>
                  <Menu.Divider style={{ borderColor: "var(--orcha-border)" }} />
                  <SignOutButton>
                    <Menu.Item
                      leftSection={<IconLogout size={15} />}
                      c="red.4"
                    >
                      Sign Out
                    </Menu.Item>
                  </SignOutButton>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <AppShell.Navbar>
          <AppShell.Section p="md">
            <Group justify="space-between" wrap="nowrap">
              <OrchaLogo collapsed={collapsed} />
              <Tooltip label={collapsed ? "Expand" : "Collapse"} withArrow position="right">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setCollapsed((c) => !c)}
                  visibleFrom="sm"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {collapsed
                      ? <path d="M9 18l6-6-6-6" />
                      : <path d="M15 18l-6-6 6-6" />}
                  </svg>
                </ActionIcon>
              </Tooltip>
            </Group>
          </AppShell.Section>

          <Divider color={BORDER_COL} />

          {/* Org pill dropdown */}
          {!collapsed && (
            <Box px="md" py="xs">
              <Menu 
                position="right-start" 
                withArrow 
                offset={15}
                styles={{
                  dropdown: { background: "#0c0a1a", borderColor: "rgba(147, 51, 234, 0.2)" },
                  item: { color: "rgba(255, 255, 255, 0.8)", fontSize: "12px" }
                }}
              >
                <Menu.Target>
                  <Group
                    gap="xs"
                    px="xs"
                    py={6}
                    style={{
                      background: "rgba(147,51,234,0.08)",
                      border: "1px solid rgba(147,51,234,0.18)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    className="org-pill-hover"
                  >
                    <style jsx>{`
                      .org-pill-hover:hover {
                        background: rgba(147, 51, 234, 0.15) !important;
                        border-color: rgba(147, 51, 234, 0.3) !important;
                      }
                    `}</style>
                    <IconBuildingSkyscraper size={14} color="#a855f7" />
                    <Text size="xs" c="violet.3" fw={500} style={{ flex: 1 }} truncate>
                      {organization?.name ?? slug}
                    </Text>
                    <IconChevronDown size={11} color="#a855f7" />
                  </Group>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label c="dimmed" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Switch Organization
                  </Menu.Label>
                  {userMemberships?.data?.map((m) => {
                    const isActive = m.organization.slug === slug;
                    return (
                      <Menu.Item
                        key={m.organization.id}
                        leftSection={<IconBuildingSkyscraper size={14} color={isActive ? "#a855f7" : "rgba(255,255,255,0.4)"} />}
                        onClick={() => {
                          if (!isActive) {
                            if (setActive) {
                              setActive({ organization: m.organization.id });
                            }
                            router.push(`/${m.organization.slug}/chat`);
                          }
                        }}
                        style={{
                          background: isActive ? "rgba(147, 51, 234, 0.1)" : "transparent",
                          fontWeight: isActive ? 600 : 400
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap" style={{ width: "100%" }}>
                          <Text size="xs" span>{m.organization.name}</Text>
                          {isActive && <Badge color="violet" size="xs" variant="light" tt="none">Active</Badge>}
                        </Group>
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>
            </Box>
          )}

          <AppShell.Section grow component={ScrollArea} px="xs" py="xs">
            <Stack gap={2}>
              {NAV_SECTIONS.map((section) => (
                <Box key={section.label}>
                  {!collapsed && (
                    <Text
                      size="10px"
                      fw={600}
                      c="dimmed"
                      px={10}
                      py={6}
                      style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}
                    >
                      {section.label}
                    </Text>
                  )}
                  <Stack gap={2}>
                    {section.items.map((item) => (
                      <SideNavItem
                        key={item.href}
                        href={`/${slug}/${item.href}`}
                        label={item.label}
                        icon={item.icon}
                        badges={item.badges}
                        active={isActive(item.href)}
                        collapsed={collapsed}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </AppShell.Section>

          <Divider color={BORDER_COL} />

          {/* Status dot */}
          <Box px="md" pb="md">
            <Group gap={6}>
              <IconPointFilled size={10} color="#22c55e" />
              {!collapsed && (
                <Text size="11px" c="dimmed">All systems operational</Text>
              )}
            </Group>
          </Box>
        </AppShell.Navbar>

        {/* ── Page content ────────────────────────────────────────────── */}
        <AppShell.Main>
          {canRenderChildren ? children : (
            <Center h="100vh">
              <Loader color="violet" type="dots" />
            </Center>
          )}
        </AppShell.Main>

        {/* ── Search Spotlight ────────────────────────────────────────── */}
        <Spotlight
          actions={spotlightActions}
          nothingFound="No configurations found"
          highlightQuery
          searchProps={{
            leftSection: <IconSearch size={18} stroke={1.5} />,
            placeholder: "Search your configurations...",
          }}
          limit={7}
          styles={{
            root: { zIndex: 1000 },
            content: {
              background: "var(--orcha-panel)",
              border: "1px solid var(--orcha-border)",
              borderRadius: "12px",
              boxShadow: "0 20px 40px var(--orcha-glow)"
            },
            action: {
              background: "transparent",
              color: "var(--orcha-text-title)",
              padding: "10px",
              borderRadius: "8px",
            }
          }}
        />
      </AppShell>
    </MantineUiProvider>
  );
}
