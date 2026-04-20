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
  private worker?: Worker;

  constructor(isWorker: boolean = false) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue("chat-queue", { connection: this.redis });

    if (isWorker) {
      console.log(`🚀 [ChatWorker] Consumer initialized. Listening for jobs...`);
      
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

            // 3. Native History Conversion
            // We must map our legacy database 'tool-invocation' parts (nested) 
            // into the flat ToolUIPart format that Vercel AI SDK 6.x expects.
            const safeContextMessages = (context.messages || []).map((m: any) => {
              const parts = Array.isArray(m.parts) ? m.parts : [];
              
              const standardParts = parts.map((p: any) => {
                // Handle standard text parts
                if (p.type === 'text') return p;

                // Map our legacy nested tool format to the flat AI SDK 6.x format
                if (p.type === 'tool-invocation' && p.toolInvocation) {
                  const ti = p.toolInvocation;
                  return {
                    type: `tool-${ti.toolName}`,
                    toolCallId: ti.toolCallId,
                    state: ti.state === 'result' ? 'output-available' : ti.state,
                    input: ti.args,
                    output: ti.result || ti.output,
                    toolName: ti.toolName,
                  };
                }

                // Handle other standard parts if they exist
                if (p.type === 'file' || p.type === 'reasoning') return p;

                return null;
              }).filter(Boolean);

              return {
                ...m,
                parts: standardParts.length > 0 ? standardParts : [{ type: 'text', text: m.content || "" }]
              };
            });
            const modelMessages = await convertToModelMessages(safeContextMessages);

            console.log(`[ChatWorker] Turn ${context.messages.length} | Normalized history: ${modelMessages.length} ModelMessage(s)`);

            const result = await agent.stream({
              messages: modelMessages,
            });

            let fullContent = "";
            const collectedParts: any[] = [];
            const pendingToolCalls = new Map<string, any>();

            const reader = result.fullStream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value.type === "text-delta") {
                fullContent += value.text;
                if (fullContent.length % 20 === 0) {
                  await pushUpdate(fullContent, [...collectedParts, { type: "text", text: fullContent || " " }]);
                }
              } else if (value.type === "tool-call") {
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
                  pending.toolInvocation.output = r; // Sync with both naming conventions
                }
                await pushUpdate(fullContent, [...collectedParts, { type: "text", text: fullContent || " " }]);
              }
            }

            const finalParts: any[] = [...collectedParts, { type: "text", text: fullContent || " " }];
            await pushUpdate(fullContent || "(Response finished)", finalParts);

            console.log(`✅ [ChatWorker] JOB COMPLETED: ${job.id}`);
            return { success: true };
          } catch (error: any) {
            console.error(`❌ [ChatWorker] JOB FAILED (${job.id}):`, error?.stack || error?.message || error);
            await pushUpdate(`⚠️ Agent error: ${error?.message || "Unknown error"}`);
            throw error;
          }
        },
        { connection: this.redis, concurrency: 50 }
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
  }
}

