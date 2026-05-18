import { generateObject } from "ai";
import { z } from "zod";

/**
 * ORCHA INTENT CLASSIFIER
 *
 * Intents:
 * - TEXT_TO_SQL:  User wants data from the database → run full RAG + LLM pipeline
 * - GENERAL:      User is asking about the AI system itself → skip RAG, answer directly
 * - IRRELEVANT:   Pure social chatter → skip everything, return a short decline message
 */

export type Intent = "TEXT_TO_SQL" | "GENERAL" | "IRRELEVANT";

const IntentSchema = z.object({
  intent: z.enum(["TEXT_TO_SQL", "GENERAL", "IRRELEVANT"]),
  suggestedTables: z
    .array(z.string())
    .describe("Table names from the database that are relevant to this query."),
  reasoning: z.string(),
});

export async function classifyIntent(
  message: string,
  model: any,
  tableNames: string[],
  businessContext?: string,
): Promise<{ intent: Intent; suggestedTables: string[] }> {
  // ── FAST HEURISTIC: zero-cost, pure-CPU short-circuit ──
  // If the message clearly starts with a data-query verb, skip the LLM entirely.
  const normalized = message.trim().toLowerCase();
  const sqlKeywords = [
    "show", "list", "get", "find", "count", "sum", "top", "how many",
    "which", "what is", "what are", "give me", "select", "fetch", "display",
    "total", "average", "breakdown", "report", "summarize", "chart", "plot",
  ];
  if (sqlKeywords.some((k) => normalized.startsWith(k) || normalized.includes(k))) {
    return { intent: "TEXT_TO_SQL", suggestedTables: [] };
  }

  const tableContext =
    tableNames.length > 0
      ? `AVAILABLE TABLES: ${tableNames.join(", ")}`
      : "No tables available.";

  const businessRules = businessContext
    ? `### BUSINESS CONTEXT:\n${businessContext}\n\n`
    : "";

  try {
    const result = await generateObject({
      model,
      schema: IntentSchema,
      system: `You are an intent classifier for a database AI assistant.

TASK: Classify the user's message into exactly one intent, then identify relevant tables.

### INTENT DEFINITIONS:

TEXT_TO_SQL → Use for ANY message asking about data, counts, lists, metrics, or anything
related to the business domain (sales, customers, orders, inventory, employees, products,
menus, etc.). When in doubt, ALWAYS default to TEXT_TO_SQL.
Examples: "show me top products", "what's on the menu?", "how many users signed up?",
"list the latest orders", "give me a summary of sales", "who are our top customers?"

GENERAL → Use ONLY when the user explicitly asks about the AI system itself, its capabilities,
what databases are connected, or how to use it.
Examples: "what can you do?", "what databases do you have access to?", "how do you work?"

IRRELEVANT → Use ONLY for pure social chatter with absolutely no data or system intent.
Examples: "hello", "thanks", "goodbye", "how are you?"

### CRITICAL RULES:
- If the message contains ANY business noun, domain term, or data-related verb → TEXT_TO_SQL.
- NEVER refuse a domain question by classifying it as IRRELEVANT or GENERAL.
- If unsure between GENERAL and TEXT_TO_SQL → always choose TEXT_TO_SQL.

${businessRules}${tableContext}`,
      prompt: `User message: "${message}"`,
    });

    return {
      intent: result.object.intent,
      suggestedTables: result.object.suggestedTables || [],
    };
  } catch (err) {
    console.warn("[IntentClassifier] Failed, defaulting to TEXT_TO_SQL:", err);
    return { intent: "TEXT_TO_SQL", suggestedTables: [] };
  }
}
