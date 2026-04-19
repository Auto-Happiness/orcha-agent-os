import { ChatWorker } from "./chat-worker";
import fs from "fs";
import path from "path";

// 🏆 Manual Environment Loader
// This ensures the worker picks up the correct Convex URL even if the 
// automatic environment loading fails or has encoding issues.
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    console.log(`[Worker] Loading environment from ${envPath}`);
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach(line => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim().replace(/^['"](.*)['"]$/, '$1');
        if (key && value) {
          process.env[key] = value;
          // console.log(`[Worker] Set ${key}=${value}`);
        }
      }
    });
  } else {
    console.warn(`[Worker] .env.local not found at ${envPath}`);
  }
}

loadEnv();

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  console.error("❌ ERROR: NEXT_PUBLIC_CONVEX_URL is still undefined after manual load.");
  process.exit(1);
}

console.log(`🚀 Starting Orcha Chat Background Worker on ${process.env.NEXT_PUBLIC_CONVEX_URL}...`);
const worker = new ChatWorker();

process.on("SIGINT", () => {
  console.log("Closing worker...");
  process.exit(0);
});
