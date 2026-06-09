/**
 * lib/db/type-normalizer.ts
 *
 * Normalizes vendor-specific SQL database column data types (e.g., character varying, int8, double precision)
 * into standardized, uppercase ANSI SQL types required by the WASM logical planning engine.
 */
export function normalizeType(rawType: string): string {
  const t = rawType.toLowerCase().trim();

  // 1. Character / String Types
  if (
    t.includes("char") ||
    t.includes("text") ||
    t.includes("varchar") ||
    t.includes("uuid") ||
    t.includes("string") ||
    t.includes("nchar") ||
    t.includes("nvarchar") ||
    t.includes("clob")
  ) {
    // Extract length if specified, e.g., varchar(255) -> VARCHAR(255)
    const lenMatch = t.match(/\(\s*(\d+)\s*\)/);
    return lenMatch ? `VARCHAR(${lenMatch[1]})` : "VARCHAR";
  }

  // 2. Large Integer Types
  if (
    t.includes("bigint") ||
    t.includes("int8") ||
    t === "serial8" ||
    t === "bigserial"
  ) {
    return "BIGINT";
  }

  // 3. Standard Integer Types
  if (
    t.includes("int") ||
    t.includes("integer") ||
    t.includes("serial") ||
    t === "mediumint" ||
    t === "smallint" ||
    t === "tinyint"
  ) {
    return "INTEGER";
  }

  // 4. Boolean Types
  if (t.includes("bool") || t === "boolean" || t === "bit") {
    return "BOOLEAN";
  }

  // 5. Decimal / Numeric Types (Preserves precision/scale if present)
  if (t.includes("decimal") || t.includes("numeric") || t.includes("money") || t.includes("dec")) {
    const precScaleMatch = t.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (precScaleMatch) {
      return `DECIMAL(${precScaleMatch[1]}, ${precScaleMatch[2]})`;
    }
    const precMatch = t.match(/\(\s*(\d+)\s*\)/);
    if (precMatch) {
      return `DECIMAL(${precMatch[1]})`;
    }
    return "DECIMAL";
  }

  // 6. Floating Point / Real Types
  if (
    t.includes("double") ||
    t.includes("float") ||
    t.includes("real") ||
    t === "float8" ||
    t === "float4"
  ) {
    return "DOUBLE";
  }

  // 7. Date / Timestamp / Datetime Types
  if (t.includes("timestamp") || t.includes("datetime")) {
    return "TIMESTAMP";
  }
  if (t === "date") {
    return "DATE";
  }
  if (t === "time") {
    return "TIME";
  }

  // 8. JSON / Document Types
  if (t === "json" || t === "jsonb") {
    return "JSON";
  }

  // Fallback to VARCHAR
  return "VARCHAR";
}
