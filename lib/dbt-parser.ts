export interface ParsedDbtColumn {
  name: string;
  description: string;
  dataType: string;
  isPrimary: boolean;
  isNullable: boolean;
}

export interface ParsedDbtModel {
  name: string;
  displayName: string;
  description: string;
  isView: boolean;
  columns: ParsedDbtColumn[];
}

export interface ParsedDbtRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export interface ParsedDbtProject {
  models: ParsedDbtModel[];
  relationships: ParsedDbtRelationship[];
}

/**
 * Parses dbt manifest.json and catalog.json files to build semantic model metadata.
 */
export function parseDbtProject(
  manifestJson: any,
  catalogJson?: any
): ParsedDbtProject {
  const models: ParsedDbtModel[] = [];
  const relationships: ParsedDbtRelationship[] = [];

  if (!manifestJson || typeof manifestJson !== "object") {
    return { models, relationships };
  }

  const nodes = manifestJson.nodes || {};
  const sources = manifestJson.sources || {};

  // Map to hold unique_id to model name for easy reference resolving
  const nodeIdToName = new Map<string, string>();
  
  // Track unique and not_null tests to infer primary keys
  // Key format: "model_name|column_name"
  const uniqueColumns = new Set<string>();
  const notNullColumns = new Set<string>();

  // Process manifest nodes to find models, sources, and tests
  const allNodes = { ...nodes, ...sources };

  // First Pass: Index model names and process column defaults
  for (const [uniqueId, node] of Object.entries(allNodes) as [string, any][]) {
    const resourceType = node.resource_type;
    
    if (resourceType === "model" || resourceType === "source") {
      const tableName = node.alias || node.name || "";
      if (!tableName) continue;

      nodeIdToName.set(uniqueId, tableName);

      const displayName = tableName
        .split("_")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      const description = node.description || "";
      const isView = node.config?.materialized === "view" || node.config?.materialized === "ephemeral";

      const columns: ParsedDbtColumn[] = [];
      const dbtCols = node.columns || {};

      for (const [colName, col] of Object.entries(dbtCols) as [string, any][]) {
        columns.push({
          name: colName,
          description: col.description || "",
          dataType: col.data_type || "VARCHAR",
          isPrimary: false, // will update in second pass
          isNullable: true,
        });
      }

      models.push({
        name: tableName,
        displayName,
        description,
        isView,
        columns,
      });
    }
  }

  // Second Pass: Process tests to extract unique/not_null constraints and relationships
  for (const [uniqueId, node] of Object.entries(allNodes) as [string, any][]) {
    const resourceType = node.resource_type;
    if (resourceType !== "test") continue;

    const testName = node.test_metadata?.name;
    const kwargs = node.test_metadata?.kwargs || {};
    const dependsOnNodes = node.depends_on?.nodes || [];

    // Find the attached model name
    const attachedModelId = node.attached_node || dependsOnNodes[0];
    const attachedModelName = nodeIdToName.get(attachedModelId);
    if (!attachedModelName) continue;

    if (testName === "unique") {
      const colName = kwargs.column_name;
      if (colName) {
        uniqueColumns.add(`${attachedModelName.toLowerCase()}|${colName.toLowerCase()}`);
      }
    } else if (testName === "not_null") {
      const colName = kwargs.column_name;
      if (colName) {
        notNullColumns.add(`${attachedModelName.toLowerCase()}|${colName.toLowerCase()}`);
      }
    } else if (testName === "relationships") {
      // dbt relationships test points from child column (field) to parent model (to)
      const fromColumn = kwargs.field || kwargs.column_name;
      const toRef = kwargs.to || "";
      
      // We need to resolve the parent table name from the `to` field
      // e.g. ref('customers') or source('stripe', 'charges')
      let toTable = "";
      
      const refMatch = toRef.match(/ref\(\s*['"]([^'"]+)['"]\s*\)/);
      const sourceMatch = toRef.match(/source\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
      
      if (refMatch) {
        toTable = refMatch[1];
      } else if (sourceMatch) {
        toTable = sourceMatch[1];
      } else {
        // Fallback cleanup
        toTable = toRef.replace(/[\{\}%'"\(\)]/g, "").replace(/\bref\b|\bsource\b/gi, "").trim();
      }

      // If toTable is still a full path, take the last part
      if (toTable.includes(".")) {
        const parts = toTable.split(".");
        toTable = parts[parts.length - 1];
      }

      // If depends_on contains the parent model, let's map it to table name if possible
      const parentModelId = dependsOnNodes.find((id: string) => id !== attachedModelId);
      if (parentModelId) {
        const resolvedParentName = nodeIdToName.get(parentModelId);
        if (resolvedParentName) {
          toTable = resolvedParentName;
        }
      }

      // Parent column is usually 'id' or matching column if not specified
      const toColumn = kwargs.field || kwargs.column_name || fromColumn;

      if (attachedModelName && toTable && fromColumn && toColumn) {
        relationships.push({
          fromTable: attachedModelName,
          fromColumn,
          toTable,
          toColumn,
          constraintName: node.name || uniqueId,
        });
      }
    }
  }

  // Update primary keys based on unique + not_null heuristic
  for (const model of models) {
    for (const col of model.columns) {
      const key = `${model.name.toLowerCase()}|${col.name.toLowerCase()}`;
      if (uniqueColumns.has(key) && notNullColumns.has(key)) {
        col.isPrimary = true;
        col.isNullable = false;
      }
      
      // Fallback: If column name is exactly "id" or "uuid" and has a unique constraint
      if ((col.name.toLowerCase() === "id" || col.name.toLowerCase() === "uuid") && uniqueColumns.has(key)) {
        col.isPrimary = true;
        col.isNullable = false;
      }
    }
  }

  // Step 3: Enhance column data types using catalog.json if available
  if (catalogJson && typeof catalogJson === "object") {
    const catalogNodes = catalogJson.nodes || {};
    const catalogSources = catalogJson.sources || {};
    const allCatalog = { ...catalogNodes, ...catalogSources };

    // Create a mapping of table name to column type catalog
    const catalogMap = new Map<string, Record<string, string>>();

    for (const node of Object.values(allCatalog) as any[]) {
      const tableName = node.metadata?.name || node.name || "";
      if (!tableName) continue;

      const columnTypes: Record<string, string> = {};
      const catCols = node.columns || {};

      for (const [colName, col] of Object.entries(catCols) as [string, any][]) {
        columnTypes[colName.toLowerCase()] = col.type || "VARCHAR";
      }

      catalogMap.set(tableName.toLowerCase(), columnTypes);
    }

    // Enhance models columns
    for (const model of models) {
      const catCols = catalogMap.get(model.name.toLowerCase());
      if (catCols) {
        for (const col of model.columns) {
          const matchedType = catCols[col.name.toLowerCase()];
          if (matchedType) {
            col.dataType = matchedType;
          }
        }
      }
    }
  }

  return { models, relationships };
}
