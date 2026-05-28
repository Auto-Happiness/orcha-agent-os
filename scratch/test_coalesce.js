import { transpileSemanticSQL } from "../lib/semantic-transpiler";

const allModels = [
  {
    _id: "m1",
    configId: "cfg1",
    tableName: "orders",
    fields: [
      { columnName: "id", type: "integer", isPrimary: true },
      { columnName: "amount", type: "double" },
      { columnName: "discount", type: "double" },
      {
        columnName: "net_revenue",
        type: "double",
        sqlExpression: "COALESCE(amount, 0.0) - COALESCE(discount, 0.0)",
      },
    ],
  },
];

const allOrgConfigs = [{ _id: "cfg1", name: "Sales DB" }];

try {
  const sql = "SELECT net_revenue FROM orders";
  const result = await transpileSemanticSQL(sql, allModels, [], "cfg1", allOrgConfigs);
  console.log("COALESCE result:", result);
} catch (err) {
  console.error("COALESCE error:", err);
}
