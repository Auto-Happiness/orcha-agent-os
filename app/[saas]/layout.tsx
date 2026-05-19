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
} from "@tabler/icons-react";
import { MantineUiProvider } from "@/lib/mantine-provider";
import { Spotlight, spotlight } from "@mantine/spotlight";
import { useQuery, useMutation } from "convex/react";
import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";

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
          <Text fw={700} size="sm" c="white" lh={1}>Orcha</Text>
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
      { href: "chat", label: "Chat", icon: IconSparkles, badge: null },
      { href: "configure", label: "Configure", icon: IconAdjustments, badge: null },
      { href: "spreadsheet", label: "Reports", icon: IconChartBar, badge: "Experimental", badgeColor: "orange" },
      { href: "command-center", label: "Command Center", icon: IconLayoutDashboard, badge: null },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "marketplace", label: "Market Place", icon: IconBuildingStore, badge: null },
      { href: "marketplace/custom", label: "Custom Tools", icon: IconTool, badge: "New", badgeColor: "blue" },
      { href: "developers", label: "Developers", icon: IconSettings, badge: "New", badgeColor: "blue" },
    ],
  },
];

/* ─── Sidebar nav item ───────────────────────────────────────────────────── */

function SideNavItem({
  href,
  label,
  icon: Icon,
  badge,
  badgeColor,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge: string | null;
  badgeColor?: string;
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
        !collapsed && badge ? (
          <Badge 
            variant="light" 
            color={badgeColor || "violet"} 
            radius="sm" 
            tt="none"
            style={{
              height: "20px",
              lineHeight: "1",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 8px",
              fontSize: "11px",
              fontWeight: 600
            }}
          >
            {badge}
          </Badge>
        ) : null
      }
      active={active}
      styles={{
        root: {
          borderRadius: "8px",
          padding: "9px 10px",
          color: active ? "#e2d9f3" : "rgba(255,255,255,0.5)",
          backgroundColor: active ? "rgba(147,51,234,0.15)" : "transparent",
          "&:hover": {
            backgroundColor: "rgba(147,51,234,0.08)",
            color: "rgba(255,255,255,0.85)",
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
  const isMember = useQuery(api.memberships.checkMembershipStatus, orgDoc?._id ? { organizationId: orgDoc._id } : "skip");
  const dbConfigs = useQuery(
    api.databaseConfigs.listByOrganization,
    orgDoc?._id ? { organizationId: orgDoc._id } : "skip"
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
    return (dbConfigs || []).map((config) => ({
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
  }, [dbConfigs, router, slug]);

  // ─── JIT Synchronization via React Query ──────────────────────────

  // 1. Sync Organization if it exists in Clerk but not Convex
  const { isLoading: isSyncingOrg } = useTanStackQuery({
    queryKey: ["jit-sync-org", slug, organization?.id],
    queryFn: async () => {
      if (!organization) return null;
      console.log("[Layout Sync] Triggering JIT Org Sync (React Query) for:", organization.slug);
      return await upsertOrg({
        clerkOrgId: organization.id,
        name: organization.name,
        slug: organization.slug || organization.id,
      });
    },
    enabled: orgDoc === null && !!organization && orgLoaded,
    staleTime: Infinity, // Only run once per session/slug
    retry: 1,
  });

  // 2. Sync Membership if user is in Clerk org but not Convex membership
  const { isLoading: isSyncingMembership } = useTanStackQuery({
    queryKey: ["jit-sync-membership", orgDoc?._id, user?.id],
    queryFn: async () => {
      if (!orgDoc?._id) return null;
      console.log("[Layout Sync] Triggering JIT Membership Sync (React Query) for org:", orgDoc._id);
      return await syncMembership({ organizationId: orgDoc._id });
    },
    enabled: isMember === false && !!orgDoc?._id && userLoaded && orgLoaded,
    staleTime: Infinity,
    retry: 1,
  });

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
  const BG_SIDEBAR = "#0c0918";
  const BG_PAGE = "#07050f";
  const BORDER_COL = "rgba(147,51,234,0.12)";

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
            background: "rgba(7,5,16,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${BORDER_COL}`,
          },
          main: { background: BG_PAGE, color: "white" },
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
                color="rgba(255,255,255,0.6)"
              />
              {/* Search hint */}
              <Group
                gap={6}
                px="sm"
                py={5}
                onClick={spotlight.open}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  minWidth: 220,
                  transition: "all 0.2s ease"
                }}
                className="hover:bg-white/10"
                visibleFrom="sm"
              >
                <IconSearch size={14} color="rgba(255,255,255,0.3)" />
                <Text size="xs" c="dimmed" style={{ flex: 1 }}>Search configurations…</Text>
                <Kbd size="xs" style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.3)" }}>⌘K</Kbd>
              </Group>
            </Group>

            {/* Right */}
            <Group gap="xs">
              {/* Notifications */}
              <Tooltip label="Notifications" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  style={{ color: "rgba(255,255,255,0.5)", position: "relative" }}
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
                      background: "#9333ea",
                      border: "2px solid #07050f",
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
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
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
                    <Text size="xs" c="rgba(255,255,255,0.75)" fw={500} visibleFrom="sm">
                      {user?.firstName}
                    </Text>
                    <IconChevronDown size={12} color="rgba(255,255,255,0.3)" />
                  </Group>
                </Menu.Target>

                <Menu.Dropdown
                  style={{
                    background: "#130f22",
                    border: "1px solid rgba(147,51,234,0.18)",
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
                    c="rgba(255,255,255,0.75)"
                  >
                    Settings
                  </Menu.Item>
                  <Menu.Divider style={{ borderColor: "rgba(255,255,255,0.06)" }} />
                  <Menu.Item leftSection={<IconHelpCircle size={15} />} c="rgba(255,255,255,0.75)">
                    Help & Docs
                  </Menu.Item>
                  <Menu.Divider style={{ borderColor: "rgba(255,255,255,0.06)" }} />
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
                        badge={item.badge}
                        badgeColor={(item as any).badgeColor}
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
              background: "#130f22",
              border: "1px solid rgba(147,51,234,0.18)",
              borderRadius: "12px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            },
            action: {
              background: "transparent",
              color: "white",
              padding: "10px",
              borderRadius: "8px",
            }
          }}
        />
      </AppShell>
    </MantineUiProvider>
  );
}
