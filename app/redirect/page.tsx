"use client";

/**
 * app/redirect/page.tsx
 *
 * Post-login resolver. Waits for Clerk to fully load, then:
 *   1. Active org slug   → /:slug/dashboard
 *   2. First membership  → /:slug/dashboard
 *   3. No org at all     → /home  (create-workspace onboarding)
 *   4. Not signed in     → / (login)
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList, useUser } from "@clerk/nextjs";

export default function RedirectPage() {
  const router     = useRouter();
  const redirected = useRef(false); // prevent double-fire

  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, isLoaded: listLoaded } = useOrganizationList({
    userMemberships: { infinite: false },
  });

  useEffect(() => {
    // Guard: only fire once, and only when every hook is settled
    if (redirected.current) return;
    if (!userLoaded || !orgLoaded || !listLoaded) return;
    // userMemberships.isLoading can still be true even when listLoaded
    if (userMemberships?.isLoading) return;

    redirected.current = true;

    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    // Prefer active org
    if (organization?.slug) {
      router.replace(`/${organization.slug}/dashboard`);
      return;
    }

    // Fallback to first membership
    const firstSlug = userMemberships?.data?.[0]?.organization?.slug;
    if (firstSlug) {
      router.replace(`/${firstSlug}/dashboard`);
      return;
    }

    // No org exists → onboarding
    router.replace("/home");
  }, [
    userLoaded, orgLoaded, listLoaded,
    isSignedIn, organization,
    userMemberships?.isLoading, userMemberships?.data,
    router,
  ]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3" style={{ background: "#07050f" }}>
      <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#9333ea" strokeWidth="4" />
        <path className="opacity-75" fill="#9333ea" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Setting up your workspace…</p>
    </div>
  );
}
