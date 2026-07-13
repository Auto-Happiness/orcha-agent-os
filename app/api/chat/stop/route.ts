// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { getChatWorker } from "@/lib/bridge/chat-worker";

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }
    
    console.log(`[Stop API] Request received to cancel job: ${jobId}`);
    const worker = getChatWorker();
    await worker.cancelJob(jobId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Stop API] Error stopping job:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
