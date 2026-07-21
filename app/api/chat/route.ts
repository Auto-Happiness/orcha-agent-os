// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@/lib/auth-helper";
import { agentHelper } from "@/lib/agent-helper";
import { Id } from "@/convex/_generated/dataModel";
import { normalizeChatHistory } from "@/lib/chat-utils";
import { withMetrics } from "@/lib/metrics";

async function postHandler(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  let isAsync = process.env.ASYNC === "on";
  console.log(`[Chat] ASYNC flag: "${process.env.ASYNC}" | isAsync: ${isAsync}`);

  try {
    const clerkAuth = await auth.getAuth();
    const body = await req.json();
    const { messages, organizationId: rawOrgId, configId: rawConfigId, configIds: rawConfigIds, modelId, showResults = true, sessionId } = body;
    let configIds = (rawConfigIds as string[]) || (rawConfigId ? [rawConfigId as string] : []);

    let userId: string | null = clerkAuth.userId;
    let organizationId: Id<"organizations"> | undefined = rawOrgId as Id<"organizations">;
    let rateLimit = 60;
    let defaultModelId: string | undefined = undefined;
    let defaultConfigId: string | undefined = undefined;

    // ── Check for API Key Auth ──
    const authHeader = req.headers.get("Authorization");
    const xApiKey = req.headers.get("x-api-key");
    const providedKey = (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : xApiKey) || undefined;

    if (providedKey) {
      isAsync = false; // Force synchronous execution for external API/SDK clients
      const apiInfo = await convex.query(api.apiKeys.validate, { key: providedKey });
      if (!apiInfo) {
        return NextResponse.json({ error: "Invalid or disabled API key." }, { status: 401 });
      }
      organizationId = apiInfo.organizationId;
      rateLimit = apiInfo.rateLimit;
      userId = "api-user"; // System user for API requests
      defaultModelId = apiInfo.defaultModelId;
      defaultConfigId = apiInfo.defaultConfigId;

      if (configIds.length === 0) {
        configIds = apiInfo.defaultConfigIds || (apiInfo.defaultConfigId ? [apiInfo.defaultConfigId] : []);
      }

      // ── CORS Origin Enforcement ──
      const origin = req.headers.get("Origin");
      if (apiInfo.corsOrigins && apiInfo.corsOrigins.length > 0) {
        if (!origin || !apiInfo.corsOrigins.includes(origin)) {
          return NextResponse.json(
            { error: `Forbidden: Origin "${origin || "unknown"}" is not authorized for this API key.` },
            { status: 403 }
          );
        }
      }

      // ── Rate Limiting Enforcement ──
      const usage = await convex.mutation(api.apiKeys.recordUsageAndCheckRateLimit, { key: providedKey });
      if (!usage.allowed) {
        return NextResponse.json(
          { error: `Too many requests. Limit is ${usage.limit} per minute.` },
          { status: 429 }
        );
      }
    } else {
      // Fallback to Clerk Auth
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const orgIdStr: string = rawOrgId || clerkAuth.orgId || "";
      if (!orgIdStr) {
        return NextResponse.json({ error: "Organization context missing." }, { status: 400 });
      }
      organizationId = orgIdStr as Id<"organizations">;
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Internal Error: Could not determine organization." }, { status: 500 });
    }

    // ── Enforce Rate Limiting ──
    const { checkRateLimit } = await import("@/lib/rate-limiter");
    const { success } = await checkRateLimit(organizationId, rateLimit);
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again in a minute." }, { status: 429 });
    }

    const orgIdStr = organizationId as string;

    // Attach Clerk JWT
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // ── ASYNC MODE: Enqueue via BullMQ ──
    if (isAsync) {
      console.log(`[Chat] ASYNC mode active. Enqueueing job for Org ${orgIdStr}`);

      let messageId: string | undefined;
      if (sessionId) {
        messageId = await convex.mutation(api.chatMessages.append, {
          sessionId: sessionId as Id<"chatSessions">,
          organizationId: organizationId,
          role: "assistant",
          content: "Agent is thinking...", // Placeholder
        });
      }

      const { getChatWorker } = await import("@/lib/bridge/chat-worker");
      const worker = getChatWorker();
      const job = await worker.addJob({
        context: {
          organizationId,
          configId: configIds[0],
          configIds,
          modelId,
          showResults,
          messages,
          userId,
          orgIdStr,
          apiKey: providedKey,
          defaultModelId,
          defaultConfigId,
        },
        messageId,
        clerkToken: token,
      });

      return NextResponse.json({
        success: true,
        mode: "async",
        jobId: job.id,
        messageId
      });
    }

    // ── SYNC MODE (Standard) ──
    const agent = await agentHelper.createChatAgent({
      convex,
      organizationId: organizationId as Id<"organizations">,
      configId: configIds[0],
      configIds,
      modelId,
      showResults,
      messages,
      userId: userId as string,
      orgIdStr,
      apiKey: providedKey,
      defaultModelId,
      defaultConfigId,
    });

    const normalizedMessages = await normalizeChatHistory(body.messages);
    const prunedMessages = normalizedMessages;

    console.log(`[Chat] History: ${normalizedMessages.length} messages`);

    const result = await agent.stream({
      messages: prunedMessages,
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("[Chat] Error:", error);
    if (error.message?.includes("[INFRASTRUCTURE_FAILURE]")) {
      const cleanMsg = error.message.replace("[INFRASTRUCTURE_FAILURE]", "").trim();
      return NextResponse.json({ error: cleanMsg }, { status: 503 });
    }
    return NextResponse.json({ error: error.message || "Unexpected error." }, { status: 500 });
  }
}

export const POST = withMetrics("/api/chat", postHandler);
