import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";

function loadEnv() {
  try {
    const envPath = path.join(__dirname, "../.env");
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  } catch (err: any) {
    console.error("Failed to load .env:", err.message);
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return;
  const client = new ConvexHttpClient(url);
  try {
    const messages = await client.query("debug:getLastMessages");
    // Print the last 2 messages (should be user's "Give me the top 10 invoices" and the AI's response)
    const last2 = messages.slice(0, 2);
    console.log(JSON.stringify(last2, null, 2));
  } catch (err: any) {
    console.error(err);
  }
}

main().catch(console.error);
