import { generateText } from "ai";
import { resolveModel } from "../model-resolver";

/**
 * AI SQL REFINER
 * Uses LLM reasoning to translate dialect-specific SQL into DuckDB federated syntax.
 */
export class SqlRefiner {
  static async refine(
    originalSql: string,
    aliases: string[],
    defaultAlias: string | undefined,
    aliasTableMap: Map<string, string[]>,
    aiKeys: any[],
    organizationId: string
  ): Promise<string> {
    try {
      let modelId = "gemini:gemini-1.5-flash";
      if (aiKeys.find(k => k.provider === "openai")) {
        modelId = "openai:gpt-4o-mini";
      } else if (aiKeys.find(k => k.provider === "claude")) {
        modelId = "claude:claude-3-haiku-20240307";
      } else if (aiKeys.find(k => k.provider === "gemini")) {
        modelId = "gemini:gemini-1.5-flash";
      }

      const model = resolveModel(modelId, aiKeys, organizationId);

      // Build a schema catalog string so the AI knows exactly which tables exist per alias
      const schemaCatalog = aliases.map(alias => {
        const tables = aliasTableMap.get(alias);
        if (tables && tables.length > 0) {
          return `- alias: "${alias}" → available tables: [${tables.join(", ")}]`;
        }
        return `- alias: "${alias}" → (tables unknown)`;
      }).join("\n");

      const prompt = `
        You are a SQL Translation Expert. 
        Your task is to rewrite the following SQL query to be compatible with DuckDB's federated engine.
        
        CONTEXT:
        - Available Database Aliases and their REAL tables:
${schemaCatalog}
        - Primary Default Alias: ${defaultAlias || "None"}
        
        RULES:
        1. Use ONLY the aliases listed above as catalog prefixes (e.g. alias.table_name).
        2. Replace any unknown database/schema name (like 'tapalord_enterprise', 'dbo', 'public') that is NOT one of the approved aliases.
        3. CRITICAL: If a table name does not exist in the alias's table list, find the closest matching table name that DOES exist and use that instead.
        4. If the query belongs to '${defaultAlias}', ensure all tables are prefixed with '${defaultAlias}.'.
        5. Convert dialect-specific syntax (MSSQL TOP N, Postgres schemas, MySQL backticks) to standard DuckDB SQL.
        6. Return ONLY the corrected SQL. No explanation. No markdown code blocks.
        
        ORIGINAL SQL:
        ${originalSql}
        
        CORRECTED DuckDB SQL:
      `;

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.1,
      });

      return text.trim().replace(/^```sql\n?/i, "").replace(/```$/, "").trim();
    } catch (err) {
      console.warn("[SqlRefiner] AI Refinement failed, falling back to original SQL:", err);
      return originalSql;
    }
  }
}
