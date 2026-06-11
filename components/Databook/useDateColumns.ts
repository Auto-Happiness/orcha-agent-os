import { useMemo } from "react";

export function useDateColumns(allModels: any[] | undefined, entry: any | undefined) {
  return useMemo(() => {
    if (!allModels || !entry) return [];
    
    const sqlLower = entry.sql.toLowerCase();
    const discovered: { value: string; label: string }[] = [];

    // 1. Identify which tables participate in the SQL query
    const participatingModels = allModels.filter((model) => {
      const tblName = model.tableName.toLowerCase();
      const regex = new RegExp(`\\b${tblName}\\b`, "i");
      return regex.test(sqlLower);
    });

    // 2. Extract date/time fields from participating tables
    participatingModels.forEach((model) => {
      (model.fields || []).forEach((field: any) => {
        const typeLower = (field.type || "").toLowerCase();
        const rawTypeLower = (field.rawType || "").toLowerCase();
        const nameLower = field.columnName.toLowerCase();
        
        const isDateType = 
          field.isTimeDimension === true ||
          typeLower.includes("date") ||
          typeLower.includes("time") ||
          typeLower.includes("timestamp") ||
          rawTypeLower.includes("date") ||
          rawTypeLower.includes("time") ||
          rawTypeLower.includes("timestamp") ||
          nameLower.includes("date") ||
          nameLower.includes("time") ||
          nameLower.includes("timestamp") ||
          nameLower.includes("_at");
           
        if (isDateType) {
          const exists = discovered.some(c => c.value === field.columnName);
          if (!exists) {
            discovered.push({
              value: field.columnName,
              label: `${model.displayName} → ${field.displayName || field.columnName} (${field.columnName})`
            });
          }
        }
      });
    });

    // 3. Fallback: Scan resultColumns
    (entry.resultColumns || []).forEach((colName: string) => {
      const colLower = colName.toLowerCase();
      const isDateName = 
        colLower.includes("date") || 
        colLower.includes("time") || 
        colLower.includes("timestamp") || 
        colLower.includes("_at");
         
      if (isDateName) {
        const exists = discovered.some(c => c.value === colName);
        if (!exists) {
          discovered.push({
            value: colName,
            label: `Result Column → ${colName}`
          });
        }
      }
    });

    return discovered;
  }, [allModels, entry]);
}
