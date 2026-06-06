/**
 * lib/semantic-transpiler.ts
 *
 * Exposes a wrapper client to initialize and run the Semantic WASM translation
 * engine, converting semantic SQL queries into target database physical queries.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { compileToMdl } from "./semantic-compiler";

// Load WASM and dynamic import the JS wrapper
const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, "wasm-engine", "orcha_semantic_engine_bg.wasm");
const sdkModulePath = join(__dirname, "wasm-engine", "index.js");

let SemanticEngine: any = null;
let wasmModule: WebAssembly.Module | null = null;

async function getWasmModuleAndSDK() {
  if (!SemanticEngine) {
    const sdkUrl = pathToFileURL(sdkModulePath).href;
    const sdk = await import(sdkUrl);
    SemanticEngine = sdk.SemanticEngine;
  }
  if (!wasmModule) {
    const wasmBytes = readFileSync(wasmPath);
    wasmModule = await WebAssembly.compile(wasmBytes);
  }
  return { SemanticEngine, wasmModule };
}

/**
 * Returns a typed dummy value for a column based on its raw DB data type string.
 * DataFusion infers Arrow schema from the first JSON row registered — providing
 * correctly-typed values ensures SUM/AVG/date operations plan correctly instead
 * of failing with Null or Utf8 type mismatches.
 */
function typedDummyValue(rawType: string): any {
  const t = rawType.toLowerCase().trim();

  // Numeric types → 0 (Int64 / Float64)
  if (
    t.includes("int") ||       // int, bigint, smallint, tinyint, integer
    t.includes("decimal") ||
    t.includes("numeric") ||
    t.includes("float") ||
    t.includes("double") ||
    t.includes("real") ||
    t.includes("money") ||
    t.includes("number")
  ) return 0;

  // Boolean types → false
  if (t.includes("bool") || t === "bit") return false;

  // Date/time types → ISO date/timestamp strings that DataFusion can parse
  if (t.includes("timestamp") || t.includes("datetime")) return "2026-01-01T00:00:00Z";
  if (t === "date") return "2026-01-01";
  if (t.includes("time")) return "00:00:00";

  // JSON / structured types → empty object string
  if (t === "json" || t === "jsonb") return "{}";

  // Everything else (varchar, text, char, uuid, enum, etc.) → empty string
  return "";
}

/**
 * Preprocesses a SQL query to map qualified and unqualified table references
 * to their corresponding MDL model names.
 */
export function preprocessSQL(
  sql: string,
  allModels: any[],
  primaryConfigId: string,
  allOrgConfigs: any[]
): string {
  // Helper to generate database alias
  const getAlias = (configId: string) => {
    const cfg = allOrgConfigs.find((c: any) => c._id === configId);
    return cfg ? cfg.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : "";
  };

  // Build model name maps
  const tableFrequencies = new Map<string, Set<string>>();
  for (const m of allModels) {
    if (!tableFrequencies.has(m.tableName)) {
      tableFrequencies.set(m.tableName, new Set());
    }
    tableFrequencies.get(m.tableName)!.add(m.configId);
  }

  const modelMdlNames = new Map<string, string>();
  for (const m of allModels) {
    const configs = tableFrequencies.get(m.tableName)!;
    if (configs.size > 1) {
      const alias = getAlias(m.configId);
      modelMdlNames.set(m._id, `${alias}__${m.tableName}`);
    } else {
      modelMdlNames.set(m._id, m.tableName);
    }
  }

  // Convert square brackets and strip quotes to normalize SQL across dialects before preprocessing
  let processed = sql.replace(/["\[\]]/g, "");

  // Sort models by length of alias + tableName descending to prevent partial replacements
  const sortedModels = [...allModels].sort((a, b) => {
    const lenA = getAlias(a.configId).length + a.tableName.length;
    const lenB = getAlias(b.configId).length + b.tableName.length;
    return lenB - lenA;
  });

  for (const m of sortedModels) {
    const alias = getAlias(m.configId);
    const table = m.tableName;
    const mdlName = modelMdlNames.get(m._id)!;
    const isPrimary = m.configId === primaryConfigId;
    const configs = tableFrequencies.get(table)!;

    const escAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const escTable = table.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Pass 1: Replace qualified references: alias.table or "alias"."table" or alias."table" etc.
    const qualifiedPattern = new RegExp(
      `\\b(?:${escAlias}|"${escAlias}"|\\[${escAlias}\\])\\.(?:${escTable}|"${escTable}"|\\[${escTable}\\])\\b`,
      'gi'
    );
    processed = processed.replace(qualifiedPattern, `"${mdlName}"`);

    // Pass 2: Replace unqualified references: table or "table" or [table]
    // We only replace if the table is in the primary database or there's no collision across databases.
    if (isPrimary || configs.size === 1) {
      const unqualifiedPattern = new RegExp(
        `(?<!\\.)\\b(?:${escTable}|"${escTable}"|\\[${escTable}\\])\\b`,
        'gi'
      );
      processed = processed.replace(unqualifiedPattern, `"${mdlName}"`);
    }
  }

  return processed;
}

/**
 * Transpiles a semantic SQL query into a physical SQL statement by expanding 
 * virtual columns, applying join conditions, and formatting queries to the 
 * target database dialect.
 */
interface Edge {
  target: string;
  fromCol: string;
  toCol: string;
}

interface PathStep {
  fromTable: string;
  toTable: string;
  fromCol: string;
  toCol: string;
}

function extractIdentifiers(sql: string): { tables: Set<string>; columns: Set<string> } {
  const tables = new Set<string>();
  const columns = new Set<string>();
  
  const normalized = sql.replace(/["\[\]]/g, "").replace(/\s+/g, " ");
  const tokenPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?\b/g;
  
  const keywords = new Set([
    "SELECT", "FROM", "WHERE", "JOIN", "ON", "AND", "OR", "GROUP", "BY",
    "ORDER", "HAVING", "LIMIT", "OFFSET", "AS", "WITH", "INNER", "LEFT",
    "RIGHT", "OUTER", "CROSS", "FULL", "NULL", "NOT", "IN", "LIKE",
    "BETWEEN", "EXISTS", "DISTINCT", "ASC", "DESC", "CASE", "WHEN", "THEN",
    "ELSE", "END", "UNION", "ALL", "EXCEPT", "INTERSECT", "SUM", "AVG",
    "COUNT", "MIN", "MAX", "COALESCE"
  ]);

  let match;
  while ((match = tokenPattern.exec(normalized)) !== null) {
    const first = match[1];
    const second = match[2];
    
    if (second) {
      if (!keywords.has(first.toUpperCase())) {
        tables.add(first.toLowerCase());
      }
      if (!keywords.has(second.toUpperCase())) {
        columns.add(second.toLowerCase());
      }
    } else {
      if (!keywords.has(first.toUpperCase()) && !/^\d+$/.test(first)) {
        columns.add(first.toLowerCase());
      }
    }
  }
  
  return { tables, columns };
}

function extractExplicitJoinedTables(sql: string): { tables: Set<string>; rootTable: string | null } {
  const normalized = sql.replace(/["\[\]]/g, "").replace(/\s+/g, " ");
  const fromJoinPattern = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
  const tables = new Set<string>();
  let rootTable: string | null = null;
  
  let match;
  while ((match = fromJoinPattern.exec(normalized)) !== null) {
    const rawRef = match[1];
    const parts = rawRef.split(".");
    const tableName = parts[parts.length - 1].toLowerCase();
    tables.add(tableName);
    if (!rootTable) {
      rootTable = tableName;
    }
  }
  
  return { tables, rootTable };
}

function findShortestPath(
  graph: Map<string, Edge[]>,
  startNodes: string[],
  targetNode: string
): PathStep[] | null {
  const queue: string[] = [...startNodes];
  const visited = new Set<string>(startNodes);
  const parentMap = new Map<string, { parent: string; edge: Edge }>();
  
  let found = false;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetNode) {
      found = true;
      break;
    }
    
    const edges = graph.get(curr) || [];
    for (const edge of edges) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        parentMap.set(edge.target, { parent: curr, edge });
        queue.push(edge.target);
      }
    }
  }
  
  if (!found) return null;
  
  const path: PathStep[] = [];
  let curr = targetNode;
  while (parentMap.has(curr)) {
    const { parent, edge } = parentMap.get(curr)!;
    path.unshift({
      fromTable: parent,
      toTable: curr,
      fromCol: edge.fromCol,
      toCol: edge.toCol
    });
    curr = parent;
  }
  
  return path;
}

export function injectJoinPaths(
  sql: string,
  allModels: any[],
  relationships: any[]
): string {
  const explicitJoined = extractExplicitJoinedTables(sql);
  if (!explicitJoined.rootTable) {
    return sql;
  }

  const explicitIdent = extractIdentifiers(sql);
  
  const referencedTables = new Set<string>();
  for (const t of explicitIdent.tables) {
    referencedTables.add(t);
  }
  
  for (const col of explicitIdent.columns) {
    for (const model of allModels) {
      const hasCol = model.fields?.some(
        (f: any) => f.columnName.toLowerCase() === col || (f.displayName && f.displayName.toLowerCase() === col)
      );
      if (hasCol) {
        referencedTables.add(model.tableName.toLowerCase());
      }
    }
  }

  const missingTables: string[] = [];
  for (const t of referencedTables) {
    if (!explicitJoined.tables.has(t)) {
      missingTables.push(t);
    }
  }

  if (missingTables.length === 0) {
    return sql;
  }

  const modelIdToTableName = new Map<string, string>();
  for (const m of allModels) {
    modelIdToTableName.set(m._id, m.tableName.toLowerCase());
  }

  const graph = new Map<string, Edge[]>();
  for (const rel of relationships) {
    const fromTable = modelIdToTableName.get(rel.fromModelId);
    const toTable = modelIdToTableName.get(rel.toModelId);
    if (!fromTable || !toTable) continue;

    if (!graph.has(fromTable)) graph.set(fromTable, []);
    if (!graph.has(toTable)) graph.set(toTable, []);

    graph.get(fromTable)!.push({
      target: toTable,
      fromCol: rel.fromColumn,
      toCol: rel.toColumn,
    });
    graph.get(toTable)!.push({
      target: fromTable,
      fromCol: rel.toColumn,
      toCol: rel.fromColumn,
    });
  }

  const joinsToInject: string[] = [];
  const alreadyJoined = new Set<string>(explicitJoined.tables);

  for (const missingTable of missingTables) {
    if (alreadyJoined.has(missingTable)) continue;

    const path = findShortestPath(graph, Array.from(alreadyJoined), missingTable);
    if (path) {
      for (const step of path) {
        if (!alreadyJoined.has(step.toTable)) {
          joinsToInject.push(`JOIN ${step.toTable} ON ${step.fromTable}.${step.fromCol} = ${step.toTable}.${step.toCol}`);
          alreadyJoined.add(step.toTable);
        }
      }
    }
  }

  if (joinsToInject.length === 0) {
    return sql;
  }

  const rootEscaped = explicitJoined.rootTable.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const fromPattern = new RegExp(`\\bFROM\\s+(?:[a-zA-Z_][a-zA-Z0-9_.]*\\s+\\.)?${rootEscaped}(?:\\s+(?:AS\\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?`, 'i');

  const match = fromPattern.exec(sql);
  if (match) {
    const insertPos = match.index + match[0].length;
    const before = sql.slice(0, insertPos);
    const after = sql.slice(insertPos);
    
    const joinSql = " " + joinsToInject.join(" ");
    return before + joinSql + after;
  }

  return sql;
}

/**
 * Transpiles a semantic SQL query into a physical SQL statement by expanding 
 * virtual columns, applying join conditions, and formatting queries to the 
 * target database dialect.
 */
export async function transpileSemanticSQL(
  sql: string,
  allModels: any[],
  relationships: any[],
  primaryConfigId: string,
  allOrgConfigs: any[]
): Promise<string> {
  const { SemanticEngine, wasmModule } = await getWasmModuleAndSDK();

  // Create a clean engine instance
  const engine = await SemanticEngine.init({ wasmUrl: wasmModule });

  try {
    // 1. Register physical tables with typed dummy rows so DataFusion infers correct schemas.
    //    Using null for every column causes DataFusion to infer all types as Null/Utf8,
    //    which breaks SUM(), AVG(), date_add(), and other typed operations at plan time.
    for (const m of allModels) {
      const dummyRow: Record<string, any> = {};
      for (const f of m.fields || []) {
        dummyRow[f.columnName] = typedDummyValue(f.rawType || f.dataType || f.type || "");
      }
      // Register under the physical table name
      await engine.registerJson(m.tableName, [dummyRow]);
    }

    // 2. Compile MDL manifest
    const mdl = compileToMdl(allModels, relationships, primaryConfigId, allOrgConfigs);

    // 3. Auto-inject missing join conditions from relationship paths
    const sqlWithJoins = injectJoinPaths(sql, allModels, relationships);

    // 4. Preprocess SQL to map database aliases and unqualified names to MDL model names
    const processedSql = preprocessSQL(sqlWithJoins, allModels, primaryConfigId, allOrgConfigs);

    // 5. Load MDL manifest into the engine
    await engine.loadMDL(mdl, { source: "" });

    // 6. Transpile using transformSql with the resolved dialect
    const primaryConfig = allOrgConfigs.find((c: any) => c._id === primaryConfigId);
    let dialect = primaryConfig?.type || "";
    if (dialect === "mariadb") {
      dialect = "mysql"; // MariaDB uses the same SQL dialect/syntax as MySQL
    }
    const transpiledSql = await engine.transformSql(processedSql, dialect);

    return transpiledSql;
  } finally {
    // Free the WASM memory
    engine.free();
  }
}
