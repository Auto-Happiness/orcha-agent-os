import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next.js 16+ middleware entry point (proxy.ts, not middleware.ts).
 *
 * Injects Clerk auth context into every request so that auth() resolves
 * a valid userId in API routes and server components.
 *
 * Route-level auth is enforced inside each handler:
 *   const { userId } = await auth();
 *   if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
