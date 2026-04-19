import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createChatAgent } from "../chat-agent";
import { convertToModelMessages } from "ai";

/**
 * ChatWorker handles AI Agent execution in the background
 * to support 100k+ users without timing out API routes or
 * overwhelming DB connection pools.
 */
export class ChatWorker {
  private redis: IORedis;
  private queue: Queue;
  private worker: Worker;
  private convex: ConvexHttpClient;

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue("chat-queue", { connection: this.redis });
    this.convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    this.worker = new Worker(
      "chat-queue",
      async (job) => {
        console.log(`\n📦 [ChatWorker] RECEIVED NEW JOB: ${job.id}`);
        const { context, messageId, clerkToken } = job.data;

        console.log(`👤 [ChatWorker] Org: ${context.orgIdStr} | User: ${context.userId}`);
        const lastMsg = context.messages?.[context.messages.length - 1];
        console.log(`💬 [ChatWorker] Input: "${String(lastMsg?.content || "").substring(0, 60)}..."`);

        // Helper: flush collected state to Convex
        const pushUpdate = async (content: string, parts?: any[]) => {
          if (!messageId) return;
          try {
            const payload: any = { messageId, content };
            if (parts) payload.parts = parts;
            await this.convex.mutation(api.chatMessages.workerUpdate, payload);
          } catch (e: any) {
            console.error("[ChatWorker] Convex update failed:", e.message);
          }
        };

        try {
          // Auth the Convex client so it can read org data from gated queries
          if (clerkToken) this.convex.setAuth(clerkToken);

          console.log("[ChatWorker] Building agent...");
          const agent = await createChatAgent({
            ...context,
            convex: this.convex,
          });

          console.log("[ChatWorker] Agent ready. Streaming response...");
          const result = await agent.stream({
            messages: await convertToModelMessages(context.messages),
          });

          let fullContent = "";
          const collectedParts: any[] = [];
          // Track pending tool calls to pair with their results
          const pendingToolCalls = new Map<string, any>();

          const reader = result.fullStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value.type === "text-delta") {
              fullContent += value.text;
              // Throttle: push text update every 40 chars
              if (fullContent.length % 40 === 0) {
                await pushUpdate(fullContent);
              }
            }

            // Capture tool calls (the SQL being run)
            else if (value.type === "tool-call") {
              const part = {
                type: "tool-result",
                toolName: value.toolName,
                toolCallId: value.toolCallId,
                input: value.input ?? (value as any).args,
                result: null, // will be filled when result arrives
              };
              pendingToolCalls.set(value.toolCallId, part);
              collectedParts.push(part);
            }

            // Capture tool results (the SQL data rows)
            else if (value.type === "tool-result") {
              const pending = pendingToolCalls.get(value.toolCallId);
              if (pending) {
                // Truncate data arrays to 20 rows max (matching sync mode)
                let r = value.result as any;
                if (r?.data && Array.isArray(r.data)) {
                  r = { ...r, data: r.data.slice(0, 20) };
                }
                pending.result = r;
              } else {
                collectedParts.push({
                  type: "tool-result",
                  toolName: value.toolName,
                  toolCallId: value.toolCallId,
                  result: value.result,
                });
              }
            }
          }

          // Build the final parts array matching the sync mode format
          const finalParts: any[] = [
            ...collectedParts,
            { type: "text", text: fullContent },
          ];

          // Final flush with all parts
          await pushUpdate(fullContent || "(No response generated)", finalParts);

          console.log(`✅ [ChatWorker] JOB COMPLETED: ${job.id} (${fullContent.length} chars, ${collectedParts.length} tool parts)`);
          return { success: true };
        } catch (error: any) {
          console.error(`❌ [ChatWorker] JOB FAILED (${job.id}):`, error?.message || error);
          await pushUpdate(`⚠️ Agent error: ${error?.message || "Unknown error"}`);
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: 50,
      }
    );

    this.worker.on("failed", (job, err) => {
      console.error(`[ChatWorker] Worker failed job ${job?.id}:`, err.message);
    });
  }

  async addJob(data: any) {
    return await this.queue.add("chat-job", data);
  }
}
