import { generateObject } from "ai";
import { z } from "zod";
import { LanguageModel } from "./model-resolver";

export const prunerSchema = z.object({
  results: z.array(z.object({
    table_name: z.string(),
    table_selection_reason: z.string(),
    table_contents: z.object({
      chain_of_thought_reasoning: z.array(z.string()),
      columns: z.array(z.string())
    })
  }))
});

export function getPruningModelId(modelId: string): string {
  const colonIdx = modelId.indexOf(":");
  const provider = modelId.substring(0, colonIdx);
  const modelName = modelId.substring(colonIdx + 1);

  if (provider === "openai") {
    if (modelName.includes("mini") || modelName.includes("3.5")) return modelId;
    return "openai:gpt-4o-mini";
  }
  if (provider === "gemini") {
    if (modelName.includes("flash")) return modelId;
    return "gemini:gemini-1.5-flash";
  }
  if (provider === "claude" || provider === "anthropic") {
    // Downgrade to Haiku for cost-effective pruning
    return "claude:claude-haiku-4-5";
  }
  return modelId;
}

export async function pruneColumns(
  question: string,
  models: any[],
  relationships: any[],
  pruningModel: LanguageModel
): Promise<any[]> {
  console.log(`[ColumnPruner] Pruning ${models.length} tables...`);

  const tempDDL = models.map((model: any) => {
    const fields = model.fields.map((f: any) => 
      `${f.displayName} (${f.columnName}): ${f.type}${f.description ? ` | Info: ${f.description}` : ""}${f.remarks ? ` | Note: ${f.remarks}` : ""}`
    ).join(", ");
    return `Table: ${model.tableName}. Description: ${model.description || ""}. Columns: [${fields}]`;
  }).join("\n");

  const { object: prunedResults } = await generateObject({
    model: pruningModel,
    schema: prunerSchema,
    system: `### TASK ###
            You are a highly skilled data analyst. Your goal is to examine the provided database schema, interpret the user's question, and identify all necessary tables and columns required to construct an accurate SQL query.

            ### INSTRUCTIONS ###
            1. Analyze the schema and identify essential tables and columns.
            2. ALWAYS include columns used for filtering (WHERE clauses), sorting (ORDER BY), grouping (GROUP BY), or joining (Primary Keys and Foreign Keys).
            3. FILTER COLUMNS: Look closely at any constraints or conditions in the user's question (e.g., 'unpaid', 'active', 'recent', 'overdue', 'before 2023'). You MUST select the columns that allow filtering by these values (e.g., 'payment_status', 'is_active', 'status', 'created_at', 'invoice_date'), even if they are not explicitly named in the question.
            4. RECORD IDENTIFICATION: Always include key identifying columns for the selected tables (like 'name', 'title', 'email', 'code', 'status', 'created_at') so the generated SQL can display readable information, not just raw numeric IDs.
            5. BE GENEROUS: Do not over-prune. If there is a chance a column might be needed for the query or filter, err on the side of caution and INCLUDE it.
            6. Provide the response as a JSON object matching the requested schema.`,
    prompt: `User Question: "${question}"\n\n### Available Schema ###\n${tempDDL}`,
  });

  const pruningMap = new Map<string, Set<string>>();
  for (const res of prunedResults.results) {
    // We normalize the table name to ensure matches despite case differences
    pruningMap.set(res.table_name.toLowerCase(), new Set(res.table_contents.columns));
  }

  const relColumns = new Set<string>();
  relationships.forEach((rel: any) => {
    relColumns.add(`${rel.fromModelId}:${rel.fromColumn}`);
    relColumns.add(`${rel.toModelId}:${rel.toColumn}`);
  });

  const finalModels = models.map((model: any) => {
    let selectedColumns: Set<string> | undefined;
    for (const [key, value] of pruningMap.entries()) {
      if (model.tableName.toLowerCase() === key || model.tableName.toLowerCase().endsWith("." + key) || key.endsWith("." + model.tableName.toLowerCase())) {
        selectedColumns = value;
        break;
      }
    }
    if (!selectedColumns) return null; 

    // Normalize selected column names to lowercase for safer matching
    const normalizedSelected = new Set(Array.from(selectedColumns).map(c => c.toLowerCase()));

    return {
      ...model,
      fields: model.fields.filter((f: any) =>
        normalizedSelected.has(f.columnName.toLowerCase()) ||
        normalizedSelected.has(f.displayName.toLowerCase()) ||
        f.isPrimary ||
        relColumns.has(`${model._id}:${f.columnName}`)
      )
    };
  }).filter(Boolean);

  // FALLBACK: If the pruner was too aggressive and returned nothing, 
  // or if the LLM hallucinated table names, revert to the original RAG results.
  if (finalModels.length === 0 && models.length > 0) {
    console.warn(`[ColumnPruner] Pruning resulted in empty schema. Falling back to original results.`);
    return models;
  }

  console.log(`[ColumnPruner] Pruning complete. Reduced schema context significantly.`);
  return finalModels;
}
