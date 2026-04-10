import { CellMatrix } from "./types";

// Lightweight formula evaluator inspired by fortune-sheet's FormulaCache
// Supports: =SUM, =AVERAGE, =MIN, =MAX, =COUNT, =IF, =CONCAT, cell refs (A1, B2:C5)

function colLetterToIndex(s: string): number {
  s = s.toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

function parseCellRef(ref: string): [number, number] | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return [parseInt(m[2]) - 1, colLetterToIndex(m[1])];
}

function getCellNum(data: CellMatrix, r: number, c: number): number {
  const cell = data[r]?.[c];
  if (!cell) return 0;
  const v = typeof cell.v === "number" ? cell.v : parseFloat(String(cell.v ?? ""));
  return isNaN(v) ? 0 : v;
}

function getRangeValues(data: CellMatrix, ref: string): number[] {
  const parts = ref.split(":");
  if (parts.length === 1) {
    const pos = parseCellRef(parts[0]);
    if (!pos) return [];
    return [getCellNum(data, pos[0], pos[1])];
  }
  const from = parseCellRef(parts[0]);
  const to = parseCellRef(parts[1]);
  if (!from || !to) return [];
  const vals: number[] = [];
  for (let r = from[0]; r <= to[0]; r++) {
    for (let c = from[1]; c <= to[1]; c++) {
      vals.push(getCellNum(data, r, c));
    }
  }
  return vals;
}

// Tokenize formula args (handles nested parens)
function splitArgs(s: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" ) depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { args.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

export function evalFormula(formula: string, data: CellMatrix): string | number {
  if (!formula.startsWith("=")) return formula;
  const expr = formula.slice(1).trim();

  try {
    return evalExpr(expr, data);
  } catch (e: any) {
    return "#ERR";
  }
}

function evalExpr(expr: string, data: CellMatrix): string | number {
  expr = expr.trim();

  // Function call: NAME(...)
  const fnMatch = expr.match(/^([A-Z]+)\((.*)\)$/is);
  if (fnMatch) {
    const fn = fnMatch[1].toUpperCase();
    const argsRaw = splitArgs(fnMatch[2]);
    const args = argsRaw.map(a => evalExpr(a, data));

    switch (fn) {
      case "SUM": {
        let sum = 0;
        for (const a of argsRaw) sum += getRangeValues(data, a).reduce((s, v) => s + v, 0);
        return sum;
      }
      case "AVERAGE": {
        const vals = argsRaw.flatMap(a => getRangeValues(data, a));
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      }
      case "MIN": {
        const vals = argsRaw.flatMap(a => getRangeValues(data, a));
        return vals.length ? Math.min(...vals) : 0;
      }
      case "MAX": {
        const vals = argsRaw.flatMap(a => getRangeValues(data, a));
        return vals.length ? Math.max(...vals) : 0;
      }
      case "COUNT": {
        const vals = argsRaw.flatMap(a => getRangeValues(data, a));
        return vals.filter(v => !isNaN(v)).length;
      }
      case "IF": {
        const cond = args[0];
        return (cond && cond !== 0 && cond !== "FALSE" && cond !== "false")
          ? (args[1] ?? "")
          : (args[2] ?? "");
      }
      case "CONCAT":
      case "CONCATENATE":
        return args.map(String).join("");
      case "LEN":
        return String(args[0] ?? "").length;
      case "UPPER":
        return String(args[0] ?? "").toUpperCase();
      case "LOWER":
        return String(args[0] ?? "").toLowerCase();
      case "ROUND": {
        const n = Number(args[0] ?? 0);
        const d = Number(args[1] ?? 0);
        return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
      }
      case "ABS":
        return Math.abs(Number(args[0] ?? 0));
      case "SQRT":
        return Math.sqrt(Number(args[0] ?? 0));
      default:
        return "#NAME?";
    }
  }

  // String literal
  if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);

  // Number literal
  const num = Number(expr);
  if (!isNaN(num) && expr !== "") return num;

  // Cell range reference (e.g. A1 or B2:C5) — return first value for single cell
  if (/^[A-Z]+\d+(:[A-Z]+\d+)?$/i.test(expr)) {
    const vals = getRangeValues(data, expr.toUpperCase());
    return vals[0] ?? 0;
  }

  // Simple arithmetic: handle +, -, *, /
  // Split on + or - (not inside parens)
  for (const op of ["+", "-", "*", "/"]) {
    const idx = findOperator(expr, op);
    if (idx !== -1) {
      const left = Number(evalExpr(expr.slice(0, idx), data));
      const right = Number(evalExpr(expr.slice(idx + 1), data));
      if (op === "+") return left + right;
      if (op === "-") return left - right;
      if (op === "*") return left * right;
      if (op === "/") return right !== 0 ? left / right : "#DIV/0!";
    }
  }

  return "#ERR";
}

function findOperator(expr: string, op: string): number {
  let depth = 0;
  // Search right-to-left for + and -, left-to-right for * and /
  const reverse = op === "+" || op === "-";
  const indices = Array.from({ length: expr.length }, (_, i) => reverse ? expr.length - 1 - i : i);
  for (const i of indices) {
    const ch = expr[i];
    if (ch === ")") depth++;
    else if (ch === "(") depth--;
    else if (ch === op && depth === 0 && i > 0) return i;
  }
  return -1;
}
