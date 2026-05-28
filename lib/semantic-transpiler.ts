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

  let processed = sql;

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
    // 1. Register physical tables with dummy rows so DataFusion knows their schemas
    for (const m of allModels) {
      const dummyRow: Record<string, any> = {};
      for (const f of m.fields || []) {
        dummyRow[f.columnName] = null;
      }
      // Register under the physical table name
      await engine.registerJson(m.tableName, [dummyRow]);
    }

    // 2. Compile MDL manifest
    const mdl = compileToMdl(allModels, relationships, primaryConfigId, allOrgConfigs);

    // 3. Preprocess SQL to map database aliases and unqualified names to MDL model names
    const processedSql = preprocessSQL(sql, allModels, primaryConfigId, allOrgConfigs);

    // 4. Load MDL manifest into the engine
    await engine.loadMDL(mdl, { source: "" });

    // 5. Transpile using transformSql
    const transpiledSql = await engine.transformSql(processedSql);

    return transpiledSql;
  } finally {
    // Free the WASM memory
    engine.free();
  }
}
