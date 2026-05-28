import { test } from "node:test";
import assert from "node:assert/strict";
import { preprocessSQL, transpileSemanticSQL } from "../semantic-transpiler";

test("preprocessSQL maps table references correctly", () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [{ columnName: "id" }, { columnName: "amount" }],
    },
    {
      _id: "m2",
      configId: "cfg2",
      tableName: "orders",
      fields: [{ columnName: "id" }],
    },
  ];

  const allOrgConfigs = [
    { _id: "cfg1", name: "Sales DB" },
    { _id: "cfg2", name: "Archive DB" },
  ];

  // Primary config is cfg1 (Sales DB). Unqualified "orders" should map to "sales_db__orders"
  // Qualified "archive_db.orders" should map to "archive_db__orders"
  const sql = "SELECT * FROM orders JOIN archive_db.orders ON orders.id = archive_db.orders.id";
  const processed = preprocessSQL(sql, allModels, "cfg1", allOrgConfigs);

  assert.equal(
    processed,
    'SELECT * FROM "sales_db__orders" JOIN "archive_db__orders" ON "sales_db__orders".id = "archive_db__orders".id'
  );
});

test("transpileSemanticSQL translates virtual columns and joins end-to-end", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      displayName: "Orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
        { columnName: "customer_id", type: "integer" },
        // Virtual calculated column
        {
          columnName: "amount_with_tax",
          type: "double",
          sqlExpression: "amount * 1.05",
        },
      ],
    },
    {
      _id: "m2",
      configId: "cfg1",
      tableName: "customers",
      displayName: "Customers",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "name", type: "varchar" },
      ],
    },
  ];

  const relationships = [
    {
      name: "CustomerOrders",
      fromModelId: "m2",
      fromColumn: "id",
      toModelId: "m1",
      toColumn: "customer_id",
      type: "one_to_many",
    },
  ];

  const allOrgConfigs = [{ _id: "cfg1", name: "Sales DB" }];

  // Let's transpile a query using a virtual column and accessing relationship field
  const semanticSql = "SELECT name, amount_with_tax FROM orders JOIN customers ON orders.customer_id = customers.id";

  const physicalSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    relationships,
    "cfg1",
    allOrgConfigs
  );

  // The transpiled physical query should expand the calculated column:
  // "orders"."amount" * 1.05 or similar, and map model names to physical tables.
  assert.ok(physicalSql.includes("1.05"));
  assert.ok(physicalSql.toLowerCase().includes("orders"));
  assert.ok(physicalSql.toLowerCase().includes("customers"));
});
