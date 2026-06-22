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
if (!configIdArg) {
  console.error("Usage: npx tsx scripts/export-memory.ts <configId>");
  process.exit(1);
}

async function exportMemory() {
  const client = new ConvexHttpClient(convexUrl!);
  const { api } = require("../convex/_generated/api");

  console.log(`[Export] Fetching semantic memory mappings for config: ${configIdArg}...`);
  try {
    const memories = await client.query(api.semanticMemory.listByConfig, {
      configId: configIdArg as any,
    });

    const exportData = memories.map((m: any) => ({
      question: m.question,
      sql: m.sql,
    }));

    const outputPath = path.resolve(process.cwd(), "datasamples", `queries-seed-${configIdArg}.json`);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf8");
    console.log(`[Export] Successfully exported ${exportData.length} records to ${outputPath}`);
  } catch (err: any) {
    console.error(`[Export] Error during export: ${err.message}`);
    process.exit(1);
  }
}

exportMemory();
