import IORedis from "ioredis";
import { Queue } from "bullmq";
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
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue("chat-queue", { connection });
  
  try {
    const failed = await queue.getFailed(0, 5);
    for (const job of failed) {
      console.log(`\n=== JOB ${job.id} ===`);
      console.log("Failed Reason:", job.failedReason);
      console.log("Data:", JSON.stringify(job.data, null, 2));
      console.log("Stacktrace:");
      if (Array.isArray(job.stacktrace)) {
        job.stacktrace.forEach(line => console.log(line));
      } else {
        console.log(job.stacktrace);
      }
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

main().catch(console.error);
