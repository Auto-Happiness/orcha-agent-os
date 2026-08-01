/**
 * Returns the Convex backend URL for server-side use.
 *
 * IMPORTANT: Next.js inlines `NEXT_PUBLIC_*` env vars at BUILD TIME into
 * the server bundle as string literals. Inside Docker, the runtime override
 * is ignored for these vars. We therefore prefer a non-NEXT_PUBLIC server-only
 * env var (`CONVEX_URL`) which is always read at runtime, and fall back to
 * `NEXT_PUBLIC_CONVEX_URL` for local `npm run dev`.
 */
export function getServerConvexUrl(): string {
  const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Neither CONVEX_URL nor NEXT_PUBLIC_CONVEX_URL is set");
  return url;
}
