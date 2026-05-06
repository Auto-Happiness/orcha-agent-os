"use client";

/**
 * app/redirect/page.tsx
 *
 * Post-login resolver. Waits for Clerk to fully load, then:
 *   1. Active org slug   → /:slug/chat
 *   2. First membership  → /:slug/chat
 *   3. No org at all     → /home  (onboarding)
 *   4. Not signed in     → / (login)
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList, useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function RedirectPage() {
  const router     = useRouter();
  const redirected = useRef(false); // prevent double-fire

  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, isLoaded: listLoaded } = useOrganizationList({
    userMemberships: { infinite: false },
  });
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const syncUser = useMutation(api.users.storeUser);

  useEffect(() => {
    // Guard: only fire once, and only when every hook is settled
    if (redirected.current) return;
    if (!userLoaded || !orgLoaded || !listLoaded || authLoading) return;
    // userMemberships.isLoading can still be true even when listLoaded
    if (userMemberships?.isLoading) return;

    const performSyncAndRedirect = async () => {
      if (!isSignedIn || !user) {
        redirected.current = true;
        router.replace("/");
        return;
      }

      // 1. Check for organizations first (Clerk-side)
      // We can do this without waiting for Convex auth
      const activeSlug = organization?.slug || organization?.id;
      const firstOrg = userMemberships?.data?.[0]?.organization;
      const firstSlug = firstOrg?.slug || firstOrg?.id;
      const targetSlug = activeSlug || firstSlug;

      if (!targetSlug) {
        // No org exists → onboarding
        redirected.current = true;
        router.replace("/home");
        return;
      }

      // 2. If we DO have an org, we want to sync the user to Convex before proceeding
      // This is where we MUST wait for Convex auth
      if (!isAuthenticated) return; 
      
      redirected.current = true;

      try {
        await syncUser({
          name: user.fullName || undefined,
          email: user.primaryEmailAddress?.emailAddress,
          avatarUrl: user.imageUrl,
        });
      } catch (err) {
        console.error("Failed to lazy-sync user during redirect:", err);
      }

      // 3. Final redirect to the workspace
      router.replace(`/${targetSlug}/chat`);
    };

    performSyncAndRedirect();
  }, [
    userLoaded, orgLoaded, listLoaded, authLoading, isAuthenticated,
    isSignedIn, organization, user,
    userMemberships?.isLoading, userMemberships?.data,
    router, syncUser
  ]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3" style={{ background: "#07050f" }}>
      <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#9333ea" strokeWidth="4" />
        <path className="opacity-75" fill="#9333ea" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Setting up your secure session…</p>
    </div>
  );
}
