import { generateText, LanguageModel, UIMessage } from "ai";

/**
 * Rewrites a conversational follow-up question into a standalone query.
 * If the user's query is already standalone, it returns the original.
 */
export async function rewriteConversationalQuery(
  messages: UIMessage[],
  pruningModel: LanguageModel
): Promise<string> {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUserMessage = (userMessages[userMessages.length - 1] as any)?.content || "";

  // Guard: If it's the first turn, no history exists to rewrite
  if (messages.length <= 2 || userMessages.length <= 1) {
    return lastUserMessage;
  }

  // To keep latency low and avoid token waste, only feed the last 4 messages as history context
  const recentMessages = messages.slice(-4);
  const formattedHistory = recentMessages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${(m as any).content || ""}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: pruningModel,
      system: `You are a search query optimizer for a database RAG system.
Your task is to analyze the conversation history and rewrite the user's latest follow-up message into a standalone, context-independent search query.

CRITICAL RULES:
1. Resolve all pronouns (like "them", "it", "they", "those") and reference words using the conversation context.
2. The output MUST be a standalone search query containing the relevant entity/nouns (e.g. rewrite "Can you list them down" -> "list the desserts" if the user was talking about desserts).
3. Do NOT answer the query or add conversational text. Only return the rewritten query.
4. If the latest message is already a complete, standalone question, return the original text exactly.`,
      prompt: `### CONVERSATION HISTORY:
${formattedHistory}

### LATEST FOLLOW-UP MESSAGE TO REWRITE:
"${lastUserMessage}"`,
    });

    const rewritten = text.trim();
    console.log(`[QueryRewriter] Original: "${lastUserMessage}" -> Rewritten: "${rewritten}"`);
    return rewritten;
  } catch (err) {
    console.warn("[QueryRewriter] LLM rewriting failed, falling back to heuristic:", err);
    // Fallback to regex heuristic
    const prevUserMessage = (userMessages[userMessages.length - 2] as any)?.content || "";
    const hasContinuation = lastUserMessage.length < 50 || 
      /\b(them|it|that|those|they|these|him|her|here|there|show|list|get|find|run|display|detail|more|explain|describe|yes|no|correct)\b/i.test(lastUserMessage);

    return (prevUserMessage && hasContinuation)
      ? `${prevUserMessage}\n${lastUserMessage}`
      : lastUserMessage;
  }
}
