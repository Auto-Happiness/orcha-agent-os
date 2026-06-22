import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";

// Zero-dependency env loader
function loadEnv() {
  const loadFile = (filename: string) => {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      content.split("\n").forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const parts = trimmed.split("=");
          const key = parts[0].trim();
          if (key) {
            const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  };

  loadFile(".env.local");
  loadFile(".env");
}

loadEnv();

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL environment variable is not defined.");
  process.exit(1);
}

const configIdArg = process.argv[2];
const orgIdArg = process.argv[3];
const seedFileArg = process.argv[4];

if (!configIdArg || !orgIdArg || !seedFileArg) {
  console.error("Usage: npx tsx scripts/import-memory.ts <configId> <organizationId> <path_to_seed_file>");
  process.exit(1);
}

async function importMemory() {
  const filePath = path.resolve(process.cwd(), seedFileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Seed file not found at ${filePath}`);
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl!);
  const { api } = require("../convex/_generated/api");

  console.log(`[Import] Parsing seed file: ${filePath}...`);
  try {
    const rawData = fs.readFileSync(filePath, "utf8");
    const seedData = JSON.parse(rawData);

    if (!Array.isArray(seedData)) {
      throw new Error("Invalid seed format: Expected a JSON array of query mappings.");
    }

    console.log(`[Import] Seeding ${seedData.length} query memory records to config: ${configIdArg}...`);
    let count = 0;
    for (const item of seedData) {
      if (!item.question || !item.sql) {
        console.warn(`[Import] Skipping invalid row: ${JSON.stringify(item)}`);
        continue;
      }

      await client.mutation(api.semanticMemory.createManualMapping, {
        organizationId: orgIdArg as any,
        configId: configIdArg as any,
        question: item.question,
        sql: item.sql,
      });
      count++;
    }

    console.log(`[Import] Successfully imported ${count} / ${seedData.length} memory records.`);
  } catch (err: any) {
    console.error(`[Import] Seeding failed: ${err.message}`);
    process.exit(1);
  }
}

importMemory();
