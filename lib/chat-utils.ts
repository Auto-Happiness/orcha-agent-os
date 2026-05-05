import { convertToModelMessages } from "ai";

/**
 * Normalizes chat history from Convex into the format expected by the Vercel AI SDK.
 *
 * WHY THIS EXISTS:
 * Both Sync mode (route.ts) and Async mode (chat-worker.ts) must run the SAME
 * normalization before feeding history to the agent. This shared util guarantees
 * they are always identical.
 *
 * WHAT IT DOES:
 * - Maps legacy nested "tool-invocation" parts (stored in Convex) to the flat
 *   ToolUIPart format that AI SDK 6.x expects.
 * - Ensures every message has at least one valid part so the SDK never chokes.
 *
 * NOTE: convertToModelMessages from the AI SDK is async — normalizeChatHistory
 * must be awaited at every call site.
 */
export async function normalizeChatHistory(messages: any[]) {
  const safeMessages = (messages || []).map((m: any) => {
    const parts = Array.isArray(m.parts) ? m.parts : [];

    const standardParts = parts.map((p: any) => {
      // Standard text part — pass through as-is
      if (p.type === "text") return p;

      // Legacy nested tool format → flat AI SDK 6.x format
      if (p.type === "tool-invocation" && p.toolInvocation) {
        const ti = p.toolInvocation;
        return {
          type: `tool-${ti.toolName}`,
          toolCallId: ti.toolCallId,
          state: ti.state === "result" ? "output-available" : ti.state,
          input: ti.args,
          output: ti.result ?? ti.output,
          toolName: ti.toolName,
        };
      }

      // Other known passthrough types
      if (p.type === "file" || p.type === "reasoning") return p;

      // Drop unknown/null parts
      return null;
    }).filter(Boolean);

    return {
      ...m,
      // Always guarantee at least one text part so the SDK never sees an empty parts array
      parts: standardParts.length > 0
        ? standardParts
        : [{ type: "text", text: m.content || "" }],
    };
  });

  return convertToModelMessages(safeMessages);
}

/**
 * Trims tool result data to MAX_RESULT_ROWS rows before persisting to Convex.
 * Applied identically in both Sync (chat/page.tsx onFinish) and Async (chat-worker.ts).
 */
export const MAX_RESULT_ROWS = 20;

export function trimToolResultParts(parts: any[]): any[] {
  return parts.map((p: any) => {
    if (p.output?.data && Array.isArray(p.output.data)) {
      return { ...p, output: { ...p.output, data: p.output.data.slice(0, MAX_RESULT_ROWS) } };
    }
    // Legacy nested format
    if (p.toolInvocation?.result?.data && Array.isArray(p.toolInvocation.result.data)) {
      return {
        ...p,
        toolInvocation: {
          ...p.toolInvocation,
          result: { ...p.toolInvocation.result, data: p.toolInvocation.result.data.slice(0, MAX_RESULT_ROWS) },
        },
      };
    }
    return p;
  });
}
