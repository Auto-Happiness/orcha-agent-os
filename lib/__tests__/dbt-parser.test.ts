import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDbtProject } from "../dbt-parser";

test("dbt-parser: parses basic manifest nodes and relationships", () => {
  const manifest = {
    nodes: {
      "model.jaffle_shop.customers": {
        resource_type: "model",
        name: "customers",
        alias: "dim_customers",
        description: "Customer dimension table",
        config: { materialized: "table" },
        columns: {
          customer_id: { name: "customer_id", description: "Unique customer identifier", data_type: "integer" },
          first_name: { name: "first_name", description: "First name of customer", data_type: "varchar" },
        },
      },
      "model.jaffle_shop.orders": {
        resource_type: "model",
        name: "orders",
        alias: "fct_orders",
        description: "Orders fact table",
        config: { materialized: "view" },
        columns: {
          order_id: { name: "order_id", description: "Unique order identifier", data_type: "integer" },
          customer_id: { name: "customer_id", description: "Customer link key", data_type: "integer" },
          amount: { name: "amount", description: "Order amount", data_type: "numeric" },
        },
      },
      "test.jaffle_shop.unique_fct_orders_order_id": {
        resource_type: "test",
        test_metadata: {
          name: "unique",
          kwargs: { column_name: "order_id" },
        },
        attached_node: "model.jaffle_shop.orders",
        depends_on: { nodes: ["model.jaffle_shop.orders"] },
      },
      "test.jaffle_shop.not_null_fct_orders_order_id": {
        resource_type: "test",
        test_metadata: {
          name: "not_null",
          kwargs: { column_name: "order_id" },
        },
        attached_node: "model.jaffle_shop.orders",
        depends_on: { nodes: ["model.jaffle_shop.orders"] },
      },
      "test.jaffle_shop.relationships_fct_orders_customer_id__ref_dim_customers_": {
        resource_type: "test",
        test_metadata: {
          name: "relationships",
          kwargs: {
            field: "customer_id",
            column_name: "customer_id",
            to: "ref('customers')",
          },
        },
        attached_node: "model.jaffle_shop.orders",
        depends_on: { nodes: ["model.jaffle_shop.orders", "model.jaffle_shop.customers"] },
      },
    },
  };

  const parsed = parseDbtProject(manifest);

  assert.equal(parsed.models.length, 2);
  
  // Verify dim_customers
  const customers = parsed.models.find(m => m.name === "dim_customers");
  assert.ok(customers);
  assert.equal(customers.displayName, "Dim Customers");
  assert.equal(customers.description, "Customer dimension table");
  assert.equal(customers.isView, false);
  assert.equal(customers.columns.length, 2);

  // Verify fct_orders
  const orders = parsed.models.find(m => m.name === "fct_orders");
  assert.ok(orders);
  assert.equal(orders.displayName, "Fct Orders");
  assert.equal(orders.description, "Orders fact table");
  assert.equal(orders.isView, true);
  assert.equal(orders.columns.length, 3);

  // Verify primary key inference on orders.order_id
  const orderIdCol = orders.columns.find(c => c.name === "order_id");
  assert.ok(orderIdCol);
  assert.equal(orderIdCol.isPrimary, true);
  assert.equal(orderIdCol.isNullable, false);

  // Verify customer_id is NOT primary key
  const custIdCol = orders.columns.find(c => c.name === "customer_id");
  assert.ok(custIdCol);
  assert.equal(custIdCol.isPrimary, false);

  // Verify relationship extraction
  assert.equal(parsed.relationships.length, 1);
  const rel = parsed.relationships[0];
  assert.equal(rel.fromTable, "fct_orders");
  assert.equal(rel.fromColumn, "customer_id");
  assert.equal(rel.toTable, "dim_customers");
  assert.equal(rel.toColumn, "customer_id");
});

test("dbt-parser: type enhancement from catalog.json", () => {
  const manifest = {
    nodes: {
      "model.jaffle_shop.customers": {
        resource_type: "model",
        name: "customers",
        description: "Customers table",
        columns: {
          id: { name: "id", description: "ID key", data_type: "integer" },
          name: { name: "name", description: "Name text" }, // Missing data_type
        },
      },
    },
  };

  const catalog = {
    nodes: {
      "model.jaffle_shop.customers": {
        metadata: { name: "customers" },
        columns: {
          id: { type: "INTEGER" },
          name: { type: "VARCHAR(256)" },
        },
      },
    },
  };

  const parsed = parseDbtProject(manifest, catalog);

  const customers = parsed.models.find(m => m.name === "customers");
  assert.ok(customers);
  
  const idCol = customers.columns.find(c => c.name === "id");
  assert.equal(idCol?.dataType, "INTEGER");

  const nameCol = customers.columns.find(c => c.name === "name");
  assert.equal(nameCol?.dataType, "VARCHAR(256)");
});
