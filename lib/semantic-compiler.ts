/**
 * lib/semantic-compiler.ts
 *
 * Compiles Orcha/Convex database models and relationships into a valid
 * Semantic MDL (Modeling Definition Language) manifest.
 */

export interface CompiledMdl {
  catalog: string;
  schema: string;
  models: any[];
  relationships: any[];
  views: any[];
}

export function compileToMdl(
  allModels: any[],
  relationships: any[],
  primaryConfigId: string,
  allOrgConfigs: any[]
): CompiledMdl {
  // Helper to generate the clean database alias
  const getAlias = (configId: string) => {
    const cfg = allOrgConfigs.find((c: any) => c._id === configId);
    return cfg ? cfg.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : "";
  };

  // Step 1: Detect table name collisions across different database configurations
  const tableFrequencies = new Map<string, Set<string>>();
  for (const m of allModels) {
    if (!tableFrequencies.has(m.tableName)) {
      tableFrequencies.set(m.tableName, new Set());
    }
    tableFrequencies.get(m.tableName)!.add(m.configId);
  }

  // Map model ID to its MDL model name
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

  // Step 2: Initialize column metadata map
  const modelColumnsMap = new Map<string, any[]>();
  const modelPrimaryKeys = new Map<string, string>();

  for (const m of allModels) {
    let primaryKey: string | undefined = undefined;
    const cols = (m.fields || []).map((f: any) => {
      const col: any = {
        name: f.columnName,
        type: (f.rawType || f.dataType || f.type || "VARCHAR").toUpperCase(),
      };
      if (f.sqlExpression) {
        col.expression = f.sqlExpression;
        col.isCalculated = true;
      }
      if (f.isPrimary) {
        primaryKey = f.columnName;
      }
      return col;
    });

    modelColumnsMap.set(m._id, cols);
    if (primaryKey) {
      modelPrimaryKeys.set(m._id, primaryKey);
    }
  }

  // Step 3: Populate relationship-based columns on the models
  for (const rel of relationships) {
    const fromModelMdlName = modelMdlNames.get(rel.fromModelId);
    const toModelMdlName = modelMdlNames.get(rel.toModelId);
    if (!fromModelMdlName || !toModelMdlName) continue;

    const fromCols = modelColumnsMap.get(rel.fromModelId)!;
    const toCols = modelColumnsMap.get(rel.toModelId)!;

    // Add relationship column to fromModel pointing to toModel
    let fromRelColName = toModelMdlName.toLowerCase();
    if (fromCols.some(c => c.name === fromRelColName)) {
      fromRelColName = `${toModelMdlName.toLowerCase()}_by_${rel.fromColumn.toLowerCase()}`;
    }
    fromCols.push({
      name: fromRelColName,
      type: toModelMdlName,
      relationship: rel.name,
    });

    // Add relationship column to toModel pointing to fromModel
    let toRelColName = fromModelMdlName.toLowerCase();
    if (toCols.some(c => c.name === toRelColName)) {
      toRelColName = `${fromModelMdlName.toLowerCase()}_by_${rel.toColumn.toLowerCase()}`;
    }
    toCols.push({
      name: toRelColName,
      type: fromModelMdlName,
      relationship: rel.name,
    });
  }

  // Step 4: Map models to Semantic MDL structure
  const models = allModels.map((m: any) => {
    const mdlName = modelMdlNames.get(m._id)!;
    const alias = getAlias(m.configId);
    const columns = modelColumnsMap.get(m._id)!;
    const primaryKey = modelPrimaryKeys.get(m._id);

    const modelObj: any = {
      name: mdlName,
      tableReference: {
        catalog: null,
        schema: alias,
        table: m.tableName,
      },
      columns,
    };

    if (primaryKey) {
      modelObj.primaryKey = primaryKey;
    }

    return modelObj;
  });

  // Step 5: Map relationships to Semantic MDL structure
  const mappedRelationships = relationships
    .map((rel: any) => {
      const fromModelMdlName = modelMdlNames.get(rel.fromModelId);
      const toModelMdlName = modelMdlNames.get(rel.toModelId);
      if (!fromModelMdlName || !toModelMdlName) return null;

      return {
        name: rel.name,
        models: [fromModelMdlName, toModelMdlName],
        joinType: rel.type.toUpperCase(),
        condition: `${fromModelMdlName}.${rel.fromColumn} = ${toModelMdlName}.${rel.toColumn}`,
      };
    })
    .filter(Boolean);

  return {
    catalog: "orcha",
    schema: "public",
    models,
    relationships: mappedRelationships,
    views: [],
  };
}
