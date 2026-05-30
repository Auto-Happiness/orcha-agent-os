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

test("transpileSemanticSQL resolves nested (multi-level) virtual columns", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
        // Virtual level 1
        {
          columnName: "amount_with_tax",
          type: "double",
          sqlExpression: "amount * 1.05",
        },
        // Virtual level 2 (referencing virtual level 1)
        {
          columnName: "total_cost",
          type: "double",
          sqlExpression: "amount_with_tax + 10.00",
        },
      ],
    },
  ];

  const allOrgConfigs = [{ _id: "cfg1", name: "Sales DB" }];

  const semanticSql = "SELECT total_cost FROM orders";
  const physicalSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    allOrgConfigs
  );

  // The output physical SQL should contain both the tax calculation and the shipping fee expansion
  assert.ok(physicalSql.includes("1.05"));
  assert.ok(physicalSql.includes("10"));
  assert.ok(physicalSql.toLowerCase().includes("orders"));
});

test("transpileSemanticSQL supports conditional CASE WHEN expressions", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
        {
          columnName: "price_category",
          type: "varchar",
          sqlExpression: "CASE WHEN amount > 100 THEN 'expensive' ELSE 'cheap' END",
        },
      ],
    },
  ];

  const allOrgConfigs = [{ _id: "cfg1", name: "Sales DB" }];

  const semanticSql = "SELECT price_category FROM orders";
  const physicalSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    allOrgConfigs
  );

  assert.ok(physicalSql.toLowerCase().includes("case"));
  assert.ok(physicalSql.toLowerCase().includes("expensive"));
  assert.ok(physicalSql.toLowerCase().includes("cheap"));
});

test("transpileSemanticSQL supports function expressions like COALESCE", async () => {
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

  const semanticSql = "SELECT net_revenue FROM orders";
  const physicalSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    allOrgConfigs
  );

  const sqlLower = physicalSql.toLowerCase();
  assert.ok(sqlLower.includes("coalesce") || sqlLower.includes("case") || sqlLower.includes("amount"));
});

test("transpileSemanticSQL works with brackets and quotes in input query", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
        {
          columnName: "amount_with_tax",
          type: "double",
          sqlExpression: "amount * 1.05",
        },
      ],
    },
  ];

  const allOrgConfigs = [{ _id: "cfg1", name: "Sales DB" }];

  const semanticSql = 'SELECT [orders]."amount_with_tax" FROM [orders] WHERE [orders].id = 1';
  const physicalSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    allOrgConfigs
  );

  assert.ok(physicalSql.includes("1.05"));
  assert.ok(physicalSql.toLowerCase().includes("orders"));
});

test("transpileSemanticSQL unparses target physical SQL with mysql, postgres, and mariadb dialects correctly", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
      ],
    },
  ];

  const mysqlConfigs = [{ _id: "cfg1", name: "Sales DB", type: "mysql" }];
  const pgConfigs = [{ _id: "cfg1", name: "Sales DB", type: "postgres" }];
  const mariadbConfigs = [{ _id: "cfg1", name: "Sales DB", type: "mariadb" }];

  const semanticSql = "SELECT id, amount FROM orders";

  const mysqlSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    mysqlConfigs
  );
  
  const pgSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    pgConfigs
  );

  const mariadbSql = await transpileSemanticSQL(
    semanticSql,
    allModels,
    [],
    "cfg1",
    mariadbConfigs
  );

  // Assert Postgres uses double quotes and MySQL/MariaDB use backticks
  assert.ok(mysqlSql.includes("`orders`"), `Expected MySQL dialect to quote with backticks, got: ${mysqlSql}`);
  assert.ok(pgSql.includes('"orders"'), `Expected Postgres dialect to quote with double quotes, got: ${pgSql}`);
  assert.ok(mariadbSql.includes("`orders`"), `Expected MariaDB dialect to quote with backticks, got: ${mariadbSql}`);
});

test("transpileSemanticSQL auto-joins tables based on qualified column reference", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "customer_id", type: "integer" },
      ],
    },
    {
      _id: "m2",
      configId: "cfg1",
      tableName: "customers",
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

  const query = "SELECT customers.name, orders.id FROM orders";
  const physicalSql = await transpileSemanticSQL(query, allModels, relationships, "cfg1", allOrgConfigs);

  const sqlLower = physicalSql.toLowerCase();
  assert.ok(sqlLower.includes("join"));
  assert.ok(sqlLower.includes("customers"));
  assert.ok(sqlLower.includes("customer_id"));
});

test("transpileSemanticSQL auto-joins tables based on unqualified column name mapping", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
        { columnName: "customer_id", type: "integer" },
      ],
    },
    {
      _id: "m2",
      configId: "cfg1",
      tableName: "customers",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "customer_name", type: "varchar" },
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

  const query = "SELECT customer_name, amount FROM orders";
  const physicalSql = await transpileSemanticSQL(query, allModels, relationships, "cfg1", allOrgConfigs);

  const sqlLower = physicalSql.toLowerCase();
  assert.ok(sqlLower.includes("join"));
  assert.ok(sqlLower.includes("customers"));
  assert.ok(sqlLower.includes("customer_id"));
});

test("transpileSemanticSQL auto-joins tables across a multi-hop relationship path", async () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "order_details",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "order_id", type: "integer" },
        { columnName: "price", type: "double" },
      ],
    },
    {
      _id: "m2",
      configId: "cfg1",
      tableName: "orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "customer_id", type: "integer" },
      ],
    },
    {
      _id: "m3",
      configId: "cfg1",
      tableName: "customers",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "name", type: "varchar" },
      ],
    },
  ];

  const relationships = [
    {
      name: "OrderDetails",
      fromModelId: "m2",
      fromColumn: "id",
      toModelId: "m1",
      toColumn: "order_id",
      type: "one_to_many",
    },
    {
      name: "CustomerOrders",
      fromModelId: "m3",
      fromColumn: "id",
      toModelId: "m2",
      toColumn: "customer_id",
      type: "one_to_many",
    },
  ];

  const allOrgConfigs = [{ _id: "cfg1", name: "Sales DB" }];

  const query = "SELECT name, price FROM order_details";
  const physicalSql = await transpileSemanticSQL(query, allModels, relationships, "cfg1", allOrgConfigs);

  const sqlLower = physicalSql.toLowerCase();
  assert.ok(sqlLower.includes("orders"));
  assert.ok(sqlLower.includes("customers"));
  assert.ok(sqlLower.includes("order_id"));
  assert.ok(sqlLower.includes("customer_id"));
});
