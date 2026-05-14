import { generateObject } from "ai";
import { z } from "zod";

/**
 * TODO : fix hallucination it's being strict to simple words like what's on the menu since it's a food database it should understand that we're talking about food and so on
 * ORCHA INTENT CLASSIFIER

 * Intents:
 * - TEXT_TO_SQL: User wants data from the database → run full RAG + LLM pipeline
 * - GENERAL:     User is asking about the schema or the system → skip RAG, answer directly
 * - IRRELEVANT:  Off-topic message → skip everything, return a short decline message
 */

export type Intent = "TEXT_TO_SQL" | "GENERAL" | "IRRELEVANT";

const IntentSchema = z.object({
  intent: z.enum(["TEXT_TO_SQL", "GENERAL", "IRRELEVANT"]),
  suggestedTables: z.array(z.string()).describe("A list of table names from the database that are relevant to this query."),
  reasoning: z.string(),
});

export async function classifyIntent(
  message: string,
  model: any,
  tableNames: string[],
  businessContext?: string,
): Promise<{ intent: Intent; suggestedTables: string[] }> {
  // Fast heuristic: skip classification for very short obvious SQL phrases
  const normalized = message.trim().toLowerCase();
  const sqlKeywords = ["show", "list", "get", "find", "count", "sum", "top", "how many", "which", "what is", "give me", "select"];
  if (sqlKeywords.some((k) => normalized.startsWith(k))) {
    return { intent: "TEXT_TO_SQL", suggestedTables: [] };
  }

  const tableContext = tableNames.length > 0
    ? `AVAILABLE TABLES: ${tableNames.join(", ")}`
    : "No tables available.";

  const businessRules = businessContext
    ? `### LIBRARIAN'S COMMON SENSE CONTEXT:
${businessContext}

` : "";

  try {
    const result = await generateObject({
      model,
      schema: IntentSchema,
      system: `You are an intent classifier and table discovery agent for a database assistant.
      
TASK:
1. Classify the user's message intent.
2. If the intent is TEXT_TO_SQL, identify which tables from the "AVAILABLE TABLES" list below are most likely needed to answer the question.

${businessRules}
INTENTS:
- TEXT_TO_SQL: The user wants to query data.
- GENERAL: The user is asking about the system, the schema, or capabilities.
- IRRELEVANT: Casual conversation (e.g. "thanks", "hello").

${tableContext}

Be decisive. Even if names don't match exactly, pick the tables that seem semantically relevant (e.g., 'menu' matches 'meals').`,
      prompt: `User message: "${message}"`,
    });

    return {
      intent: result.object.intent,
      suggestedTables: result.object.suggestedTables || []
    };
  } catch (err) {
    console.warn("[IntentClassifier] Failed, defaulting to TEXT_TO_SQL:", err);
    return { intent: "TEXT_TO_SQL", suggestedTables: [] };
  }
}
