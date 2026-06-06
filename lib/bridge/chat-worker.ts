import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createChatAgent } from "../chat-agent";
import { normalizeChatHistory, trimToolResultParts } from "../chat-utils";

/**
 * ChatWorker handles AI Agent execution in the background
 * to support 100k+ users without timing out API routes or
 * overwhelming DB connection pools.
 */
export class ChatWorker {
  private redis: IORedis;
  private queue: Queue;
  private worker?: Worker;
  private workerRedis?: IORedis;

  constructor(isWorker: boolean = false) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue("chat-queue", { connection: this.redis });

    if (isWorker) {
      console.log(`🚀 [ChatWorker] Consumer initialized. Listening for jobs...`);
      this.workerRedis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      
      this.worker = new Worker(
        "chat-queue",
        async (job) => {
          console.log(`\n📦 [ChatWorker] RECEIVED NEW JOB: ${job.id}`);
          const { context, messageId, clerkToken } = job.data;
          
          // 1. Fresh Convex client per job for multi-user isolation
          const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
          if (clerkToken) convex.setAuth(clerkToken);

          if (!process.env.ENCRYPTION_KEY) {
            console.error("[ChatWorker] FATAL: ENCRYPTION_KEY is missing in worker. Tools WILL fail.");
          }

          console.log(`👤 [ChatWorker] Org: ${context.orgIdStr} | User: ${context.userId}`);

          const pushUpdate = async (content: string, parts?: any[]) => {
            if (!messageId) return;
            try {
              const payload: any = { messageId, content };
              if (parts) payload.parts = parts;
              await convex.mutation(api.chatMessages.workerUpdate, payload);
            } catch (e: any) {
              console.error("[ChatWorker] Convex update failed:", e.message);
            }
          };

          try {
            console.log("[ChatWorker] Building agent...");
            const agent = await createChatAgent({
              ...context,
              convex,
            });

            const modelMessages = await normalizeChatHistory(context.messages);
            const prunedMessages = modelMessages;

            console.log(`[ChatWorker] Turn ${context.messages.length} | History: ${modelMessages.length} msgs`);

            const result = await agent.stream({
              messages: prunedMessages,
            });

            let fullContent = "";
            let currentText = "";
            const collectedParts: any[] = [];
            const pendingToolCalls = new Map<string, any>();

            // Helper to build the parts array for the current update tick
            const getPartsToPush = (appendText: string) => {
              if (appendText) {
                return [...collectedParts, { type: "text", text: appendText }];
              }
              return collectedParts;
            };

            const REASONING_MARKER = "### \uD83E\uDDE0 Reasoning";

            let lastPushedLength = 0;
            const reader = result.fullStream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value.type === "text-delta") {
                fullContent += value.text;
                currentText += value.text;
                if (fullContent.length - lastPushedLength >= 20) {
                  await pushUpdate(fullContent, trimToolResultParts(getPartsToPush(currentText)));
                  lastPushedLength = fullContent.length;
                }
              } else if (value.type === "tool-call") {
                // BULLETPROOF REASONING INJECTION:
                // Some models skip the reasoning block even when instructed not to.
                // Guarantee one is always present at the code level — no prompt dependency.
                if (!currentText.trim()) {
                  // AI produced zero text — inject a default reasoning block using the tool name
                  const toolLabel = value.toolName
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                  currentText = `${REASONING_MARKER}\n- Calling \`${toolLabel}\` to retrieve the information needed to answer your question.`;
                  fullContent = currentText + fullContent;
                  await pushUpdate(fullContent, trimToolResultParts(getPartsToPush(currentText)));
                  lastPushedLength = fullContent.length;
                } else if (!currentText.toLowerCase().includes("reasoning")) {
                  // AI produced text but without the reasoning header — prepend it
                  currentText = `${REASONING_MARKER}\n${currentText.trim()}`;
                }

                // Commit the guaranteed reasoning block as a frozen part
                collectedParts.push({ type: "text", text: currentText });
                currentText = ""; // Fresh slate for any text after the tool

                const args = typeof (value as any).args === 'string' ? JSON.parse((value as any).args) : (value.input ?? (value as any).args);
                const part = {
                  type: "tool-invocation",
                  toolInvocation: {
                    state: "call",
                    toolCallId: value.toolCallId,
                    toolName: value.toolName,
                    args: args,
                    result: null,
                  }
                };
                pendingToolCalls.set(value.toolCallId, part);
                collectedParts.push(part);
              } else if (value.type === "tool-result") {
                const pending = pendingToolCalls.get(value.toolCallId);
                if (pending) {
                  let r = (value as any).result ?? (value as any).output;
                  if (r?.data && Array.isArray(r.data)) {
                    r = { ...r, data: r.data.slice(0, 20) };
                  }
                  pending.toolInvocation.state = "result";
                  pending.toolInvocation.result = r;
                  pending.toolInvocation.output = r;
                }
                await pushUpdate(fullContent, trimToolResultParts(getPartsToPush(currentText)));
              }
            }

            const finalParts: any[] = trimToolResultParts(getPartsToPush(currentText));
            await pushUpdate(fullContent || "(Response finished)", finalParts);

            console.log(`✅ [ChatWorker] JOB COMPLETED: ${job.id}`);
            return { success: true };
          } catch (error: any) {
            console.error(`❌ [ChatWorker] JOB FAILED (${job.id}):`, error?.stack || error?.message || error);
            await pushUpdate(`⚠️ Agent error: ${error?.message || "Unknown error"}`);
            throw error;
          }
        },
        { connection: this.workerRedis, concurrency: 50 }
      );

      this.worker.on("failed", (job, err) => {
        console.error(`[ChatWorker] Worker failed job ${job?.id}:`, err.message);
      });
    }
  }

  async addJob(data: any) {
    return await this.queue.add("chat-job", data, {
      removeOnComplete: {
        count: 100, // Keep only the last 100 completed jobs
        age: 24 * 3600, // Or keep for 24 hours
      },
      removeOnFail: {
        count: 500, // Keep more failures for debugging
      },
    });
  }

  async close() {
    if (this.worker) await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
    if (this.workerRedis) await this.workerRedis.quit();
  }
}

let globalChatWorker: ChatWorker | null = null;

export function getChatWorker(isWorker = false) {
  if (!globalChatWorker) {
    globalChatWorker = new ChatWorker(isWorker);
  }
  return globalChatWorker;
}

