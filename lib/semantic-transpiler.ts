/**
 * lib/semantic-transpiler.ts
 *
 * Exposes a wrapper client to initialize and run the Semantic WASM translation
 * engine, converting semantic SQL queries into target database physical queries,
 * utilizing the cloud-stored MDL JSON manifest.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { compileToMdl, CompiledMdl } from "./semantic-compiler";

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
 * Returns a typed dummy value for a column based on its standardized ANSI data type string.
 */
function typedDummyValue(ansiType: string): any {
  const t = ansiType.toUpperCase().trim();

  if (
    t.startsWith("INT") ||
    t === "INTEGER" ||
    t === "BIGINT" ||
    t === "SMALLINT" ||
    t === "TINYINT" ||
    t.startsWith("DECIMAL") ||
    t.startsWith("NUMERIC") ||
    t === "DOUBLE" ||
    t === "FLOAT" ||
    t === "REAL"
  ) {
    return 0;
  }

  if (t === "BOOLEAN") {
    return false;
  }

  if (t === "TIMESTAMP" || t === "DATETIME") {
    return "2026-01-01T00:00:00Z";
  }
  if (t === "DATE") {
    return "2026-01-01";
  }
  if (t === "TIME") {
    return "00:00:00";
  }

  if (t === "JSON" || t === "JSONB") {
    return "{}";
  }

  return "";
}

/**
 * Preprocesses a SQL query to map table references to their exact case-sensitive
 * MDL model names, wrapping them in double quotes for DataFusion logical planning.
 */
export function preprocessSQL(sql: string, mdl: CompiledMdl): string {
  let processed = sql.replace(/["\[\]]/g, "");

  // Sort model names by length descending to prevent partial replacements
  const sortedModels = [...mdl.models].sort((a, b) => b.name.length - a.name.length);

  for (const m of sortedModels) {
    const name = m.name;
    const escName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Replace qualified references: catalog.schema.table or schema.table
    const qualifiedPattern = new RegExp(
      `\\b(?:[a-zA-Z0-9_]+(?:\\.[a-zA-Z0-9_]+)?)?\\.${escName}\\b`,
      'gi'
    );
    processed = processed.replace(qualifiedPattern, `"${name}"`);

    // Replace unqualified references
    const unqualifiedPattern = new RegExp(
      `(?<!\\.)\\b${escName}\\b`,
      'gi'
    );
    processed = processed.replace(unqualifiedPattern, `"${name}"`);
  }

  return processed;
}

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

/**
 * Auto-injects join paths based on relationships defined in the MDL manifest.
 */
export function injectJoinPaths(sql: string, mdl: CompiledMdl): string {
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
    for (const model of mdl.models) {
      const hasCol = model.columns?.some(
        (c: any) => c.name.toLowerCase() === col
      );
      if (hasCol) {
        referencedTables.add(model.name.toLowerCase());
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

  const graph = new Map<string, Edge[]>();
  for (const rel of mdl.relationships) {
    const modelA = rel.models[0].toLowerCase();
    const modelB = rel.models[1].toLowerCase();
    
    const condition = rel.condition;
    const parts = condition.split("=");
    if (parts.length !== 2) continue;
    
    const partA = parts[0].trim();
    const partB = parts[1].trim();
    
    const colA = partA.substring(partA.indexOf(".") + 1);
    const colB = partB.substring(partB.indexOf(".") + 1);
    
    if (!graph.has(modelA)) graph.set(modelA, []);
    if (!graph.has(modelB)) graph.set(modelB, []);
    
    graph.get(modelA)!.push({
      target: modelB,
      fromCol: colA,
      toCol: colB,
    });
    graph.get(modelB)!.push({
      target: modelA,
      fromCol: colB,
      toCol: colA,
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
          // Resolve original model casing to match schema exactly
          const originalToModel = mdl.models.find(m => m.name.toLowerCase() === step.toTable);
          const originalFromModel = mdl.models.find(m => m.name.toLowerCase() === step.fromTable);
          const toName = originalToModel ? originalToModel.name : step.toTable;
          const fromName = originalFromModel ? originalFromModel.name : step.fromTable;

          joinsToInject.push(`JOIN "${toName}" ON "${fromName}".${step.fromCol} = "${toName}".${step.toCol}`);
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
 * Transpiles a semantic SQL query into a physical dialect-specific SQL statement
 * utilizing the parsed MDL manifest.
 */
export async function transpileSemanticSQL(
  sql: string,
  mdl: CompiledMdl,
  dialect: string
): Promise<string> {
  const { SemanticEngine, wasmModule } = await getWasmModuleAndSDK();

  // Create a clean engine instance
  const engine = await SemanticEngine.init({ wasmUrl: wasmModule });

  try {
    // 1. Register physical tables with typed dummy rows for schema validation
    for (const model of mdl.models) {
      const dummyRow: Record<string, any> = {};
      const physicalCols = model.columns.filter((c: any) => !c.relationship);
      for (const col of physicalCols) {
        dummyRow[col.name] = typedDummyValue(col.type);
      }
      
      const physicalTableName = model.tableReference?.table || model.name;
      await engine.registerJson(physicalTableName, [dummyRow]);
    }

    // 2. Auto-inject join paths
    const sqlWithJoins = injectJoinPaths(sql, mdl);

    // 3. Preprocess SQL to ensure correct case-sensitive model quoting
    const processedSql = preprocessSQL(sqlWithJoins, mdl);

    // 4. Load MDL manifest into the engine
    await engine.loadMDL(mdl, { source: "" });

    // 5. Transpile using transformSql with the target dialect
    let targetDialect = dialect.toLowerCase();
    if (targetDialect === "mariadb") {
      targetDialect = "mysql";
    }

    return await engine.transformSql(processedSql, targetDialect);
  } finally {
    engine.free();
  }
}

/**
 * Compatibility wrapper to support legacy tests that pass Convex models/relationships arrays.
 */
export async function transpileSemanticSQLCompat(
  sql: string,
  allModels: any[],
  relationships: any[],
  primaryConfigId: string,
  allOrgConfigs: any[]
): Promise<string> {
  const mdl = compileToMdl(allModels, relationships, primaryConfigId, allOrgConfigs);
  const primaryConfig = allOrgConfigs.find((c: any) => c._id === primaryConfigId);
  const dialect = primaryConfig?.type || "postgres";
  return await transpileSemanticSQL(sql, mdl, dialect);
}

export function preprocessSQLCompat(
  sql: string,
  allModels: any[],
  primaryConfigId: string,
  allOrgConfigs: any[]
): string {
  const getAlias = (configId: string) => {
    const cfg = allOrgConfigs.find((c: any) => c._id === configId);
    return cfg ? cfg.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : "";
  };
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
  let processed = sql.replace(/["\[\]]/g, "");
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
    const qualifiedPattern = new RegExp(
      `\\b(?:${escAlias}|"${escAlias}"|\\[${escAlias}\\])\\.(?:${escTable}|"${escTable}"|\\[${escTable}\\])\\b`,
      'gi'
    );
    processed = processed.replace(qualifiedPattern, `"${mdlName}"`);
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
