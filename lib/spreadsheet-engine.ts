/**
 * Simple spreadsheet formula engine.
 * Supports: 
 * - Basic math: +, -, *, /
 * - Cell references: A1, B2, etc.
 * - Parentheses: (A1 + 5) * 2
 */

export type CellData = Record<string, string>;

export function evaluateCell(
  coord: string, 
  cells: CellData, 
  visited: Set<string> = new Set(), 
  showSampleData: boolean = false,
  sampleData: Record<string, any> = {}
): string {
  let value = cells[coord];
  if (!value) return "";

  // If we are in sample mode and it's a marker, replace it with sample data
  if (showSampleData && value.startsWith("{d.") && value.endsWith("}")) {
    const key = value.replace("{d.", "").replace("}", "");
    return String(sampleData[key] ?? value);
  }

  if (!value.startsWith("=")) return value;
  
  if (visited.has(coord)) return "#REF!"; // Circular dependency
  visited.add(coord);

  try {
    const formula = value.slice(1);
    // Replace cell references with their evaluated values
    const replaced = formula.replace(/[A-Z]+\d+/g, (match) => {
      const refValue = evaluateCell(match, cells, visited);
      // If it's a number, return it. If it's empty, 0. Otherwise NaN.
      if (refValue === "") return "0";
      if (isNaN(Number(refValue))) return `(${refValue})`; // Might be a string or error
      return refValue;
    });

    // Safety: only allow basic math characters and numbers
    if (/[^0-9+\-*/().\s]/.test(replaced)) {
      // If it contains non-math chars, maybe it's a string concatenation or error
       return "#ERROR!";
    }

    // Use Function constructor for a bit more safety than eval, though still not perfect for prod
    // In a real app, use a proper expression parser like mathjs or hyperformula
    const result = new Function(`return ${replaced}`)();
    return String(result);
  } catch (e) {
    return "#ERROR!";
  }
}

export function formatCoord(colIdx: number, rowIdx: number): string {
  const col = String.fromCharCode(65 + colIdx);
  return `${col}${rowIdx + 1}`;
}

export function parseCoord(coord: string): { colIdx: number, rowIdx: number } {
  const colStr = coord.match(/[A-Z]+/)?.[0] || "A";
  const rowStr = coord.match(/\d+/)?.[0] || "1";
  const colIdx = colStr.charCodeAt(0) - 65;
  const rowIdx = parseInt(rowStr) - 1;
  return { colIdx, rowIdx };
}
