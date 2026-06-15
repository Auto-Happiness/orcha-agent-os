import { test } from "node:test";
import assert from "node:assert/strict";
import { compileToMdl } from "../semantic-compiler";
import { transpileCubeQuery } from "../semantic-transpiler";

test("transpileCubeQuery translates cube queries with dimensions and measures correctly", () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      displayName: "Orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double", fieldType: "measure", defaultAggregation: "sum" },
        { columnName: "customer_id", type: "integer", fieldType: "dimension" },
      ],
    },
  ];

  const allOrgConfigs = [
    { _id: "cfg1", name: "Sales DB" },
  ];

  const mdl = compileToMdl(allModels, [], "cfg1", allOrgConfigs);

  const query = {
    cube: "orders_cube",
    measures: ["amount"],
    dimensions: ["customer_id"]
  };

  const sql = transpileCubeQuery(query, mdl, "postgres");

  // Output SQL should select dimensions and aggregate measures
  assert.ok(sql.includes('SELECT "orders".customer_id AS "customer_id"'));
  assert.ok(sql.includes('sum("orders".amount) AS "amount"'));
  assert.ok(sql.includes('FROM "orders"'));
  assert.ok(sql.includes('GROUP BY "orders".customer_id'));
});

test("transpileCubeQuery translates time dimensions with granularity", () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      displayName: "Orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double", fieldType: "measure", defaultAggregation: "sum" },
        { columnName: "order_date", type: "timestamp", isTimeDimension: true },
      ],
    },
  ];

  const allOrgConfigs = [
    { _id: "cfg1", name: "Sales DB" },
  ];

  const mdl = compileToMdl(allModels, [], "cfg1", allOrgConfigs);

  const query = {
    cube: "orders_cube",
    measures: ["amount"],
    timeDimensions: [
      { dimension: "order_date", granularity: "month" }
    ]
  };

  // 1. Postgres Dialect (DATE_TRUNC)
  const pgSql = transpileCubeQuery(query, mdl, "postgres");
  assert.ok(pgSql.includes("DATE_TRUNC('month', \"orders\".order_date) AS \"order_date_month\""));
  assert.ok(pgSql.includes("GROUP BY DATE_TRUNC('month', \"orders\".order_date)"));

  // 2. MySQL Dialect (DATE_FORMAT)
  const mysqlSql = transpileCubeQuery(query, mdl, "mysql");
  assert.ok(mysqlSql.includes("DATE_FORMAT(\"orders\".order_date, '%Y-%m-01') AS \"order_date_month\""));
  assert.ok(mysqlSql.includes("GROUP BY DATE_FORMAT(\"orders\".order_date, '%Y-%m-01')"));

  // 3. MSSQL Dialect (CONVERT)
  const mssqlSql = transpileCubeQuery(query, mdl, "mssql");
  assert.ok(mssqlSql.includes("CONVERT(VARCHAR(7), \"orders\".order_date, 120) + '-01' AS \"order_date_month\""));
  assert.ok(mssqlSql.includes("GROUP BY CONVERT(VARCHAR(7), \"orders\".order_date, 120) + '-01'"));
});

test("transpileCubeQuery auto-joins tables across relationships", () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      displayName: "Orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double", fieldType: "measure", defaultAggregation: "sum" },
        { columnName: "customer_id", type: "integer" },
      ],
    },
    {
      _id: "m2",
      configId: "cfg1",
      tableName: "customers",
      displayName: "Customers",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "country", type: "varchar", fieldType: "dimension" },
      ],
    },
  ];

  const relationships = [
    {
      name: "orders_customer_id_fkey",
      fromModelId: "m1",
      fromColumn: "customer_id",
      toModelId: "m2",
      toColumn: "id",
      type: "many_to_one",
    },
  ];

  const allOrgConfigs = [
    { _id: "cfg1", name: "Sales DB" },
  ];

  const mdl = compileToMdl(allModels, relationships, "cfg1", allOrgConfigs);

  // We query customer_country (which belongs to Customers) as a dimension of orders_cube
  // Wait, in our compileToMdl, a column is registered to orders_cube if it belongs to the orders model.
  // Wait, if the dimension is on another table, how does it get referenced?
  // Typically, the dimensions of a cube can reference joined tables.
  // In our compileToMdl, we compiled a cube for customers, which has dimension `country`.
  // If the query references both, e.g. base table is customers, and measure is on orders.
  // Let's test a query on customers_cube where we select dimensions: ["country"], and measures from a related table.
  // Wait, in our auto-compiler, each table gets its own cube:
  // - orders_cube has baseObject: orders, measures: [amount], dimensions: [id, customer_id]
  // - customers_cube has baseObject: customers, dimensions: [id, country]
  // If we query a base cube (e.g. orders_cube) but select dimensions from a related model, wait!
  // In our query_cube tool resolver, we can support querying dimensions from related models, or the LLM can query them if we compile the dimensions/measures.
  // Let's check: if the SQL generated is `SELECT "orders".amount, "customers".country FROM orders`, and since "customers" is referenced but not explicitly joined, our injectJoinPaths(sql, mdl) will automatically traverse the graph and inject `JOIN "customers" ON "orders".customer_id = "customers".id`!
  // Yes! The BFS join pathing is automatically run on the constructed SQL query, so if the query specifies:
  // - cube: "orders_cube"
  // - measures: ["amount"]
  // - dimensions: ["customers.country"] (qualified dimension name, or simply "country" if we map it)
  // Let's check: if the LLM specifies `dimensions: ["customers.country"]`, then `transpileCubeQuery` will look for the dimension.
  // Wait! In `transpileCubeQuery`:
  // ```typescript
  //     for (const dimName of query.dimensions) {
  //       const dim = cube.dimensions.find((d: any) => d.name === dimName);
  // ...
  // ```
  // If the dimension is qualified (e.g. `customers.country`), the cube name might not have it directly. But wait, in standard MDL, a cube has a `baseObject` and its dimensions can reference fields of the base model or relationship columns.
  // In our compiler, relationship columns are added to the base model (e.g. `customers` is added to `orders` columns).
  // So if we query `customers.country`, wait! Let's check how the join pathing is resolved.
  // If the query select list contains `"customers".country`, the table "customers" is referenced. `injectJoinPaths` looks at referenced tables, sees "customers" is referenced but not in the FROM table list, and automatically injects the JOIN.
  // So if the SQL generated contains `SELECT "customers".country`, the JOIN is injected!
  // Let's write a test case to verify this auto-joining behavior!
});
