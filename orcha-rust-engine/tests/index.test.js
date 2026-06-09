import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Resolve paths to the built package
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(__dirname, "../pkg");
const jsPath = join(pkgDir, "orcha_semantic_engine.js");

const require = createRequire(import.meta.url);
const { OrchaSemanticEngine } = require(jsPath);

// Helper to get an engine instance (initialization happens automatically on require)
async function getEngine() {
    return new OrchaSemanticEngine();
}

test("OrchaSemanticEngine - compiles and initializes successfully", async () => {
    const engine = await getEngine();
    assert.ok(engine, "Engine instance should be created");
});

test("OrchaSemanticEngine - registers schema and translates calculated columns", async () => {
    const engine = await getEngine();

    const fields = [
        { name: "id", type: "integer" },
        { name: "amount", type: "double" },
        { name: "customer_id", type: "integer" },
        { name: "amount_with_tax", type: "double" }
    ];
    
    // Register orders table
    engine.register_table("orders", JSON.stringify(fields));

    // Register calculation formula
    await engine.register_calculated_column("orders", "amount_with_tax", "amount * 1.05");

    // Perform translation
    const sql = "SELECT id, amount_with_tax FROM orders";
    const physicalSql = await engine.translate_sql(sql, "");

    // Verify projection expands tax calculation
    assert.ok(physicalSql.includes("1.05"), "Physical SQL should contain tax multiplier");
    assert.ok(physicalSql.toLowerCase().includes("orders"), "Physical SQL should reference target table");
});
