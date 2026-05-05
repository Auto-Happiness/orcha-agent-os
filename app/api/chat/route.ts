import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { createChatAgent } from "@/lib/chat-agent";
import { Id } from "@/convex/_generated/dataModel";
import { normalizeChatHistory } from "@/lib/chat-utils";

export async function POST(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const isAsync = process.env.ASYNC === "on";
  console.log(`[Chat] ASYNC flag: "${process.env.ASYNC}" | isAsync: ${isAsync}`);

  try {
    const clerkAuth = await auth();
    const { userId, orgId: clerkOrgId } = clerkAuth;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages, organizationId: rawOrgId, configId: rawConfigId, modelId, showResults = true, sessionId } = body;

    const orgIdStr: string = rawOrgId || clerkOrgId || "";
    if (!orgIdStr) {
      return NextResponse.json({ error: "Organization context missing." }, { status: 400 });
    }

    const organizationId = orgIdStr as Id<"organizations">;
    const configId = rawConfigId as Id<"databaseConfigs">;

    // Attach Clerk JWT
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // ── ASYNC MODE: Enqueue via BullMQ ──
    if (isAsync) {
      console.log(`[Chat] ASYNC mode active. Enqueueing job for Org ${orgIdStr}`);
      
      // 1. Create message stub in Convex (if sessionId provided)
      let messageId: string | undefined;
      if (sessionId) {
        messageId = await convex.mutation(api.chatMessages.append, {
          sessionId: sessionId as Id<"chatSessions">,
          organizationId: organizationId,
          role: "assistant",
          content: "Agent is thinking...", // Placeholder
        });
      }

      // 2. Add to BullMQ
      const { ChatWorker } = await import("@/lib/bridge/chat-worker");
      const worker = new ChatWorker();
      const job = await worker.addJob({
        context: {
          organizationId,
          configId,
          modelId,
          showResults,
          messages,
          userId,
          orgIdStr,
        },
        messageId,
        clerkToken: token,
      });

      // Close the connection (Producer only needs it briefly)
      await worker.close();

      return NextResponse.json({ 
        success: true, 
        mode: "async", 
        jobId: job.id,
        messageId 
      });
    }

    // ── SYNC MODE (Standard) ──
    const agent = await createChatAgent({
      convex,
      organizationId,
      configId,
      modelId,
      showResults,
      messages,
      userId,
      orgIdStr,
    });

    const result = await agent.stream({
      messages: await normalizeChatHistory(body.messages),
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("[Chat] Error:", error);
    return NextResponse.json({ error: error.message || "Unexpected error." }, { status: 500 });
  }
}
