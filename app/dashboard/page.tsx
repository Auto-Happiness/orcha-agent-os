/**
 * app/dashboard/page.tsx
 *
 * Catch-all shim for anyone landing on the bare /dashboard URL
 * (e.g. old bookmarks, Clerk env-var overrides, direct navigation).
 *
 * Server-side redirect → /redirect, which then resolves the
 * correct /:slug/dashboard URL from the Clerk org membership.
 */
import { redirect } from "next/navigation";

export default function DashboardShimPage() {
  redirect("/redirect");
}
