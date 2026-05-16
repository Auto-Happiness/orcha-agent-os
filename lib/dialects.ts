export type DatabaseType = "postgres" | "mysql" | "mssql" | "bigquery" | "mongodb" | "sqlite" | "oracle" | "mariadb" | "couchdb";


export const getNativeDialectRule = (type: string): string => {
  switch (type) {
    case "mssql":
      return "- Native Dialect: T-SQL (Microsoft SQL Server). Use 'SELECT TOP N' instead of 'LIMIT'. Use square brackets [table] or [column] if needed.";
    case "mysql":
    case "mariadb":
      return `- Native Dialect: ${type === "mysql" ? "MySQL" : "MariaDB"}. Use backticks \`table\` for reserved names.`;
    case "postgres":
      return "- Native Dialect: PostgreSQL. Use double quotes \"table\" for reserved names.";
    case "sqlite":
      return "- Native Dialect: SQLite. Standard SQL syntax.";
    case "oracle":
      return "- Native Dialect: Oracle SQL. Use 'FETCH FIRST N ROWS ONLY' for limits (Oracle 12c+). Use double quotes for case-sensitive identifiers.";
    case "mongodb":
      return "- Native Dialect: MongoDB (NoSQL). Use MQL (JSON-based query syntax). Note: If using federated queries, use DuckDB SQL instead.";
    case "couchdb":
      return "- Native Dialect: CouchDB (NoSQL). Use Mango queries or MapReduce views.";
    case "bigquery":
      return "- Native Dialect: Google BigQuery. Use backticks for table names: `project.dataset.table`.";
    default:
      return "- Native Dialect: Standard SQL.";
  }
};


export const getFederatedRule = (federatedCatalog: string, primaryDbName: string): string => {
  return `
### TOOL SELECTION & SYNTAX RULES:

#### 1. Single Database Queries
- **TOOL**: Use \`execute_sql\`.
- **SYNTAX**: Use the **Native Dialect** of the database (see rules above).
- **WHEN**: Use this for requests involving ONLY the primary database: **${primaryDbName}**.

#### 2. Cross-Database (Federated) Queries
- **TOOL**: Use \`execute_federated_sql\`.
- **SYNTAX**: Use **DuckDB/PostgreSQL** syntax (e.g., ALWAYS use \`LIMIT\` instead of \`TOP\`).
- **WHEN**: Use this ONLY when you need to JOIN across different aliases (e.g. \`db1.table1\` JOIN \`db2.table2\`).
- **ALIASING**: To JOIN across databases, use the alias prefix: \`alias.table_name\`.

### CONNECTED DATABASES (Federation Catalog):
${federatedCatalog || "No additional databases connected."}
`;
};
