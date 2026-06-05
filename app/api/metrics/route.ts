import { NextRequest, NextResponse } from "next/server";
import { register } from "@/lib/metrics";

// Always evaluate at request time and run on the Node.js runtime (prom-client
// relies on Node APIs such as perf_hooks and process metrics).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Prometheus scrape endpoint. Returns all registered metrics in the
 * Prometheus text exposition format.
 *
 * Optionally protected: if METRICS_AUTH_TOKEN is set, scrapers must send
 * `Authorization: Bearer <token>`. If it's unset (default for the local
 * Docker stack), the endpoint is open.
 */
export async function GET(req: NextRequest) {
  const expectedToken = process.env.METRICS_AUTH_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers.get("Authorization");
    const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (provided !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await register.metrics();
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": register.contentType },
  });
}
