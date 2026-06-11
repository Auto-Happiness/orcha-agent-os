export const cleanSql = (sql: string): string => {
  return sql.trim().replace(/;+$/, "").trim();
};

export const stripTrailingOrderBy = (sql: string): string => {
  let depth = 0;
  for (let i = sql.length - 1; i >= 0; i--) {
    const char = sql[i];
    if (char === ')') depth++;
    else if (char === '(') depth--;
    else if (depth === 0 && i >= 8) {
      const substr = sql.substring(i - 8, i).toUpperCase();
      if (substr === 'ORDER BY') {
        if (i - 9 < 0 || /\s/.test(sql[i - 9])) {
          return sql.substring(0, i - 8).trim();
        }
      }
    }
  }
  return sql;
};

export const hasTopLevelOrderBy = (sql: string): boolean => {
  let depth = 0;
  for (let i = sql.length - 1; i >= 0; i--) {
    const char = sql[i];
    if (char === ')') depth++;
    else if (char === '(') depth--;
    else if (depth === 0 && i >= 8) {
      const substr = sql.substring(i - 8, i).toUpperCase();
      if (substr === 'ORDER BY') {
        if (i - 9 < 0 || /\s/.test(sql[i - 9])) {
          return true;
        }
      }
    }
  }
  return false;
};

export const stripSystemLimit = (sql: string, dialect: string): string => {
  const cleaned = cleanSql(sql);
  const dialectLower = dialect.toLowerCase();

  if (dialectLower === "mssql") {
    let stripped = cleaned.replace(/\s+OFFSET\s+\d+\s+ROWS(\s+FETCH\s+(?:NEXT|FIRST)\s+\d+\s+ROWS\s+ONLY)?/i, "");
    stripped = stripped.replace(/^(\s*SELECT\s+DISTINCT)\s+TOP\s+\d+/i, "$1");
    stripped = stripped.replace(/^(\s*SELECT)\s+TOP\s+\d+/i, "$1");
    return stripped.trim();
  }

  if (dialectLower === "oracle") {
    let stripped = cleaned.replace(/\s+OFFSET\s+\d+\s+ROWS(\s+FETCH\s+(?:NEXT|FIRST)\s+\d+\s+ROWS\s+ONLY)?/i, "");
    stripped = stripped.replace(/\s+FETCH\s+(?:NEXT|FIRST)\s+\d+\s+ROWS\s+ONLY/i, "");
    return stripped.trim();
  }

  let stripped = cleaned.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?/i, "");
  stripped = stripped.replace(/\s+OFFSET\s+\d+/i, "");
  return stripped.trim();
};

export const buildCountSql = (sql: string, dialect: string): string => {
  const cleaned = cleanSql(sql);
  const dialectLower = dialect.toLowerCase();
  const queryWithoutLimit = stripSystemLimit(cleaned, dialectLower);
  const queryWithoutOrderBy = stripTrailingOrderBy(queryWithoutLimit);

  return `SELECT COUNT(*) AS total_count FROM (\n${queryWithoutOrderBy}\n) _count_source`;
};

export const buildPageSql = (sql: string, offset: number, limit: number, dialect: string): string => {
  const cleaned = cleanSql(sql);
  const dialectLower = dialect.toLowerCase();
  const queryWithoutLimit = stripSystemLimit(cleaned, dialectLower);

  if (dialectLower === "oracle") {
    return `${queryWithoutLimit} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  }

  if (dialectLower === "mssql") {
    if (hasTopLevelOrderBy(queryWithoutLimit)) {
      return `${queryWithoutLimit} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    } else {
      return `${queryWithoutLimit} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }
  }

  return `${queryWithoutLimit} LIMIT ${limit} OFFSET ${offset}`;
};

export const isPaginatable = (sql: string): boolean => {
  const norm = sql.trim().toLowerCase();
  return norm.startsWith("select") || norm.startsWith("with");
};

export const getMonthFilterSql = (col: string, m: string, dialect: string) => {
  const padM = m.padStart(2, "0");
  switch (dialect.toLowerCase()) {
    case "sqlite":
      return `strftime('%m', ${col}) = '${padM}'`;
    case "postgres":
    case "oracle":
    case "bigquery":
      return `EXTRACT(MONTH FROM ${col}) = ${parseInt(m)}`;
    case "mysql":
    case "mariadb":
      return `MONTH(${col}) = ${parseInt(m)}`;
    case "mssql":
      return `DATEPART(month, ${col}) = ${parseInt(m)}`;
    default:
      return `EXTRACT(MONTH FROM ${col}) = ${parseInt(m)}`;
  }
};

export const buildFilterSql = (rules: any[], originalSql: string, dialect: string) => {
  if (rules.length === 0) return originalSql;

  const clauses = rules.map((rule) => {
    const col = rule.column;
    if (!col) return "";

    switch (rule.type) {
      case "between": {
        if (!rule.dateFrom || !rule.dateTo) return "";
        return `${col} BETWEEN '${rule.dateFrom} 00:00:00' AND '${rule.dateTo} 23:59:59'`;
      }
      case "month_year": {
        if (!rule.month || !rule.year) return "";
        const m = rule.month.padStart(2, "0");
        const y = rule.year;
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        return `${col} BETWEEN '${y}-${m}-01 00:00:00' AND '${y}-${m}-${lastDay} 23:59:59'`;
      }
      case "year": {
        if (!rule.year) return "";
        return `${col} BETWEEN '${rule.year}-01-01 00:00:00' AND '${rule.year}-12-31 23:59:59'`;
      }
      case "month": {
        if (!rule.month) return "";
        return getMonthFilterSql(col, rule.month, dialect);
      }
      default:
        return "";
    }
  }).filter(c => c !== "");

  if (clauses.length === 0) return originalSql;

  return `SELECT * FROM (\n${originalSql}\n) _filtered_data\nWHERE ${clauses.join(" AND ")}`;
};
