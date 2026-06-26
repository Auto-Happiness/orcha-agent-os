// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { withMetrics } from "@/lib/metrics";

async function postHandler(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const isAsync = process.env.ASYNC === "on";

  console.log(`[Dashboard Generator] ASYNC flag: "${process.env.ASYNC}" | isAsync: ${isAsync}`);

  try {
    const clerkAuth = await auth();
    const body = await req.json();
    const { draftPrompts, selectedConfigIds, selectedModel, organizationId: rawOrgId } = body;

    if (!clerkAuth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgIdStr = rawOrgId || clerkAuth.orgId;
    if (!orgIdStr) {
      return NextResponse.json({ error: "Organization context missing." }, { status: 400 });
    }
    const organizationId = orgIdStr as Id<"organizations">;

    if (!draftPrompts || !Array.isArray(draftPrompts) || draftPrompts.length === 0) {
      return NextResponse.json({ error: "No draft prompts provided." }, { status: 400 });
    }

    const configIds = (selectedConfigIds as string[]) || [];
    if (configIds.length === 0) {
      return NextResponse.json({ error: "No databases selected." }, { status: 400 });
    }

    // Attach Clerk JWT
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // Fetch database configurations & organization keys
    const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
    const aiKeys = await convex.query(api.aiKeys.listByOrganization, { organizationId });

    // Build mapping for aliases
    const configMap = new Map<string, any>();
    allConfigs.forEach(c => {
      const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      configMap.set(c._id, { ...c, alias });
    });

    // ── ASYNC MODE: Return stub immediately and generate in the background ──
    if (isAsync) {
      console.log(`[Dashboard Generator] ASYNC mode: Creating proposal record...`);
      const proposalId = await convex.mutation(api.bi.createProposal, { organizationId });

      // Enqueue job via DashboardWorker
      const { getDashboardWorker } = await import("@/lib/bridge/dashboard-worker");
      const worker = getDashboardWorker();
      await worker.addJob({
        proposalId,
        draftPrompts,
        configIds,
        selectedModel,
        organizationId,
        clerkToken: token,
      });

      return NextResponse.json({
        success: true,
        mode: "async",
        proposalId,
      });
    }

    // ── SYNC MODE: Block and return results ──
    const { executeGeneration } = await import("@/lib/bridge/dashboard-worker");
    const widgets = await executeGeneration({
      draftPrompts,
      configIds,
      selectedModel,
      organizationId,
      convex,
      configMap,
      aiKeys,
    });

    return NextResponse.json({
      success: true,
      mode: "sync",
      widgets,
    });

  } catch (error: any) {
    console.error("[Dashboard Generator] Error:", error);
    return NextResponse.json({ error: error.message || "Unexpected error." }, { status: 500 });
  }
}

export const POST = withMetrics("/api/bi/generate-dashboard", postHandler);
