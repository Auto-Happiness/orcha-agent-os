import { test } from "node:test";
import assert from "node:assert/strict";
import { compileToMdl } from "../semantic-compiler";

test("compileToMdl basic compilation", () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "orders",
      displayName: "Orders",
      fields: [
        { columnName: "id", type: "integer", isPrimary: true },
        { columnName: "amount", type: "double" },
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

  const allOrgConfigs = [
    { _id: "cfg1", name: "Sales DB" },
  ];

  const mdl = compileToMdl(allModels, relationships, "cfg1", allOrgConfigs);

  assert.equal(mdl.catalog, "orcha");
  assert.equal(mdl.schema, "public");
  assert.equal(mdl.models.length, 2);

  // Check models
  const orders = mdl.models.find(m => m.name === "orders");
  assert.ok(orders);
  assert.equal(orders.primaryKey, "id");
  assert.deepEqual(orders.tableReference, { catalog: null, schema: "sales_db", table: "orders" });

  // Check relationship columns on orders
  const relColOnOrders = orders.columns.find((c: any) => c.relationship === "CustomerOrders");
  assert.ok(relColOnOrders);
  assert.equal(relColOnOrders.name, "customers");
  assert.equal(relColOnOrders.type, "customers");

  // Check relationships array
  assert.equal(mdl.relationships.length, 1);
  assert.equal(mdl.relationships[0].name, "CustomerOrders");
  assert.equal(mdl.relationships[0].joinType, "ONE_TO_MANY");
  assert.equal(mdl.relationships[0].condition, "customers.id = orders.customer_id");
});

test("compileToMdl handles naming collisions", () => {
  const allModels = [
    {
      _id: "m1",
      configId: "cfg1",
      tableName: "users",
      fields: [{ columnName: "id", type: "integer" }],
    },
    {
      _id: "m2",
      configId: "cfg2",
      tableName: "users",
      fields: [{ columnName: "id", type: "integer" }],
    },
  ];

  const allOrgConfigs = [
    { _id: "cfg1", name: "DB One" },
    { _id: "cfg2", name: "DB Two" },
  ];

  const mdl = compileToMdl(allModels, [], "cfg1", allOrgConfigs);

  const modelNames = mdl.models.map(m => m.name).sort();
  assert.deepEqual(modelNames, ["db_one__users", "db_two__users"]);
});
