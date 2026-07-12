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
    // Find a user message with "invoices"
    const userMsgIndex = messages.findIndex(m => m.role === "user" && m.content.toLowerCase().includes("invoices"));
    if (userMsgIndex === -1) {
      console.log("No user message about invoices found in the last 10 messages.");
      return;
    }
    const userMsg = messages[userMsgIndex];
    console.log(`Found User Message: "${userMsg.content}" (ID: ${userMsg._id})`);
    
    // The assistant response is typically the message before it in the list (since list is desc order)
    // or we can search for an assistant message in the same session created right after
    const sessionMsgs = messages.filter(m => m.sessionId === userMsg.sessionId);
    // Sort session messages chronologically
    sessionMsgs.sort((a, b) => a.createdAt - b.createdAt);
    
    const userIndexInSession = sessionMsgs.findIndex(m => m._id === userMsg._id);
    const assistantMsg = sessionMsgs[userIndexInSession + 1];
    
    if (!assistantMsg) {
      console.log("No assistant message found after the user message.");
      return;
    }
    
    console.log(`Found Assistant Message (ID: ${assistantMsg._id}):`);
    console.log("Content:", assistantMsg.content);
    console.log("Parts:", JSON.stringify(assistantMsg.parts, null, 2));
  } catch (err: any) {
    console.error(err);
  }
}

main().catch(console.error);
