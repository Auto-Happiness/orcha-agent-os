/**
 * sql-validator.ts
 *
 * Validates that every table and column reference in a SQL string
 * exists in the compiled schema manifest BEFORE the query hits the database.
 *   - "column 'X' not found in model 'Y'" → wrong column name
 *   - "model 'X' not found"               → wrong table/alias name
 *
 * Returns a structured result the agent can use to self-correct
 * without ever touching the database.
 */

export interface ManifestTable {
  tableName: string;
  alias?: string; // federated alias (e.g. "items_service")
  columns: string[]; // exact columnNames as stored in semanticModels
}

export interface CompiledManifest {
  // Flat list of all tables across all active configs
  tables: ManifestTable[];
  // Explicit join conditions: "alias.table.col = alias.table.col"
  relationships: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Build a CompiledManifest from the allModels and relationships
 * arrays already available in chat-agent.ts.
 */
export function buildManifest(
  allModels: any[],
  relationships: any[],
  dbConfigMap: Map<string, any>,
  allOrgConfigs: any[]
): CompiledManifest {
  // Build alias → configId reverse lookup
  const aliasToConfigId = new Map<string, string>();
  for (const c of allOrgConfigs) {
    const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    aliasToConfigId.set(alias, c._id);
  }

  // Build modelId → tableName lookup for relationship resolution
  const modelIdToTable = new Map<string, { tableName: string; alias: string }>();
  for (const m of allModels) {
    const cfg = allOrgConfigs.find((c: any) => c._id === m.configId);
    const alias = cfg ? cfg.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : "";
    modelIdToTable.set(m._id, { tableName: m.tableName, alias });
  }

  const tables: ManifestTable[] = allModels.map((m: any) => {
    const cfg = allOrgConfigs.find((c: any) => c._id === m.configId);
    const alias = cfg ? cfg.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : "";
    return {
      tableName: m.tableName,
      alias,
      columns: (m.fields || []).map((f: any) => f.columnName as string),
    };
  });

  const relationshipLines: string[] = relationships.map((rel: any) => {
    const from = modelIdToTable.get(rel.fromModelId);
    const to = modelIdToTable.get(rel.toModelId);
    if (!from || !to) return "";
    const fromRef = from.alias ? `${from.alias}.${from.tableName}.${rel.fromColumn}` : `${from.tableName}.${rel.fromColumn}`;
    const toRef = to.alias ? `${to.alias}.${to.tableName}.${rel.toColumn}` : `${to.tableName}.${rel.toColumn}`;
    return `${fromRef} = ${toRef}`;
  }).filter(Boolean);

  return { tables, relationships: relationshipLines };
}

/**
 * Validates SQL against the compiled manifest.
 *
 * Catches:
 *   - Table/alias references that don't exist in the manifest
 *   - Column references that don't exist in the referenced table
 *
 * Does NOT catch: type mismatches, dialect-specific syntax errors,
 * permission issues — those are DB-level and require execution.
 */
export function validateSQL(sql: string, manifest: CompiledManifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sql || sql.trim().length === 0) {
    return { valid: false, errors: ["SQL is empty."], warnings: [] };
  }

  const normalized = sql.replace(/\s+/g, " ").trim();

  // Build lookup maps
  // tableKey = tableName (lowercase) or alias.tableName (lowercase)
  const tableMap = new Map<string, ManifestTable>();
  const aliasTableMap = new Map<string, ManifestTable>(); // "alias.table" → ManifestTable

  for (const t of manifest.tables) {
    const tableKey = t.tableName.toLowerCase();
    tableMap.set(tableKey, t);
    if (t.alias) {
      aliasTableMap.set(`${t.alias}.${t.tableName}`.toLowerCase(), t);
      aliasTableMap.set(`${t.alias.toLowerCase()}.${t.tableName.toLowerCase()}`, t);
    }
  }

  // Extract all table references from FROM and JOIN clauses
  // Handles: FROM table, FROM alias.table, JOIN table AS t, etc.
  const fromJoinPattern = /(?:FROM|JOIN)\s+([\w.]+)(?:\s+(?:AS\s+)?(\w+))?/gi;
  const sqlAliasToTable = new Map<string, ManifestTable>(); // SQL alias → manifest table

  let match: RegExpExecArray | null;
  while ((match = fromJoinPattern.exec(normalized)) !== null) {
    const rawRef = match[1]; // e.g. "customer_review" or "items_service.customer_review"
    const sqlAlias = match[2]; // e.g. "cr"

    const refLower = rawRef.toLowerCase();
    let resolved: ManifestTable | undefined =
      tableMap.get(refLower) ||
      aliasTableMap.get(refLower);

    if (!resolved) {
      // Try partial alias match: "items_service.customer_review" → split on "."
      const parts = refLower.split(".");
      if (parts.length === 2) {
        resolved = aliasTableMap.get(refLower);
        if (!resolved) {
          // Try just the table name portion
          resolved = tableMap.get(parts[1]);
        }
      }
    }

    if (!resolved) {
      errors.push(
        `Table "${rawRef}" not found in schema manifest. ` +
        `Available tables: ${manifest.tables.map(t => t.alias ? `${t.alias}.${t.tableName}` : t.tableName).join(", ")}`
      );
    } else {
      // Map both the raw reference and the SQL alias to the resolved table
      sqlAliasToTable.set(refLower, resolved);
      if (sqlAlias) {
        sqlAliasToTable.set(sqlAlias.toLowerCase(), resolved);
      }
      // Also map just the table name in case used unqualified
      sqlAliasToTable.set(resolved.tableName.toLowerCase(), resolved);
    }
  }

  // Extract column references: alias.column or table.column patterns
  // We look for identifiers in the form "word.word" that aren't part of FROM/JOIN
  const colPattern = /\b(\w+)\.(\w+)\b/g;
  const skipWords = new Set(["SELECT", "FROM", "WHERE", "JOIN", "ON", "AND", "OR",
    "GROUP", "ORDER", "BY", "HAVING", "LIMIT", "OFFSET", "AS", "WITH", "INNER",
    "LEFT", "RIGHT", "OUTER", "CROSS", "FULL", "NULL", "NOT", "IN", "LIKE",
    "BETWEEN", "EXISTS", "DISTINCT", "ASC", "DESC", "CASE", "WHEN", "THEN",
    "ELSE", "END", "UNION", "ALL", "EXCEPT", "INTERSECT"]);

  while ((match = colPattern.exec(normalized)) !== null) {
    const qualifier = match[1].toLowerCase();
    const colName = match[2].toLowerCase();

    // Skip SQL keywords and numbers
    if (skipWords.has(qualifier.toUpperCase()) || /^\d+$/.test(qualifier)) continue;
    // Skip if the qualifier itself looks like a column (not a table alias)
    if (!sqlAliasToTable.has(qualifier)) continue;

    const table = sqlAliasToTable.get(qualifier);
    if (!table) continue;

    const colExists = table.columns.some(c => c.toLowerCase() === colName);
    if (!colExists) {
      errors.push(
        `Column "${colName}" not found in table "${table.tableName}". ` +
        `Available columns: ${table.columns.join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
