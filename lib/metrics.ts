import client from "prom-client";
import type { NextRequest } from "next/server";

/**
 * Shared Prometheus metrics for the Next.js API routes.
 *
 * Grafana reads these via Prometheus, which scrapes the GET /api/metrics endpoint.
 *
 * We stash the registry + metric instances on `globalThis` so that Next.js module
 * re-evaluation (dev hot-reload, multiple route imports) does not try to register
 * the same metric name twice — prom-client throws on duplicate registration.
 */
const globalForMetrics = globalThis as unknown as {
  __orchaMetrics?: ReturnType<typeof createMetrics>;
};

function createMetrics() {
  const register = new client.Registry();
  register.setDefaultLabels({ app: "orcha-agent-os" });

  // Node process metrics: CPU, memory, event-loop lag, GC, etc.
  client.collectDefaultMetrics({ register });

  const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP API route handlers in seconds",
    labelNames: ["route", "method", "status"] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
    registers: [register],
  });

  const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP API route requests",
    labelNames: ["route", "method", "status"] as const,
    registers: [register],
  });

  const httpRequestErrors = new client.Counter({
    name: "http_request_errors_total",
    help: "Total number of API route requests that resulted in a 5xx response or a thrown error",
    labelNames: ["route", "method"] as const,
    registers: [register],
  });

  return { register, httpRequestDuration, httpRequestsTotal, httpRequestErrors };
}

const metrics = globalForMetrics.__orchaMetrics ?? (globalForMetrics.__orchaMetrics = createMetrics());

export const { register, httpRequestDuration, httpRequestsTotal, httpRequestErrors } = metrics;

type RouteHandler = (req: NextRequest, ctx?: any) => Promise<Response>;

/**
 * Wraps a Next.js App Router route handler so every request is recorded as a
 * Prometheus time series (count, latency histogram, error count) labelled by
 * route + method + status. The handler runs unchanged; on the way out we record
 * the response status, and on a thrown error we record a 500 before re-throwing.
 *
 * Usage:
 *   async function postHandler(req: NextRequest) { ... }
 *   export const POST = withMetrics("/api/chat", postHandler);
 */
export function withMetrics(route: string, handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const method = req.method ?? "POST";
    const endTimer = httpRequestDuration.startTimer({ route, method });
    let status = 500;
    try {
      const res = await handler(req, ctx);
      status = res.status ?? 200;
      return res;
    } catch (err) {
      status = 500;
      throw err;
    } finally {
      const statusStr = String(status);
      endTimer({ status: statusStr });
      httpRequestsTotal.inc({ route, method, status: statusStr });
      if (status >= 500) httpRequestErrors.inc({ route, method });
    }
  };
}
