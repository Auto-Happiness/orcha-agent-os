export enum ErrorType {
  OPERATIONAL = "OPERATIONAL", // Infra, timeouts, auth, connection failures
  LOGICAL = "LOGICAL"          // SQL syntax, missing table/column, type mismatch
}

const SECRET_PATTERNS = ["password", "secret", "token", "key", "credential"];
const MAX_ERROR_BYTES = 2048; // Cap at 2KB to protect context size

export function classifyError(error: any): { type: ErrorType; message: string } {
  const errMsg = error?.message || String(error);
  const lowerMsg = errMsg.toLowerCase();

  // 1. Classify operational vs logical
  let type = ErrorType.LOGICAL;
  if (
    lowerMsg.includes("connection") ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("access denied") ||
    lowerMsg.includes("authentication") ||
    lowerMsg.includes("database config") ||
    lowerMsg.includes("unauthorized")
  ) {
    type = ErrorType.OPERATIONAL;
  }

  // 2. Redact credentials recursively if object or replace patterns in string
  let cleanMsg = errMsg;
  SECRET_PATTERNS.forEach(pat => {
    // Match patterns like key=val or password=val in connection strings / error logs
    const regex = new RegExp(`${pat}\\s*=\\s*[^\\s;]+`, "gi");
    cleanMsg = cleanMsg.replace(regex, `${pat}=***`);
  });

  // 3. Truncate long messages
  if (cleanMsg.length > MAX_ERROR_BYTES) {
    cleanMsg = cleanMsg.slice(0, MAX_ERROR_BYTES) + "... [truncated]";
  }

  return { type, message: cleanMsg };
}
