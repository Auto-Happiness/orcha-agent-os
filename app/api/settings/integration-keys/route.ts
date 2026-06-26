// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";
import { auth } from "@clerk/nextjs/server";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, getToken } = await auth();
    const convex = getConvexClient();
    const token = await getToken({ template: "convex" });
    const { organizationId, integration, qualifiedName, mcpUrl, keyType, keyValue } = await req.json();

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!integration || !keyValue) return NextResponse.json({ error: "integration and keyValue are required." }, { status: 400 });

    if (token) convex.setAuth(token);

    // Reuse KeyManager — same three strategies: json | convex | aws_kms
    const { processedValue, strategy } = await KeyManager.prepareForStorage({
      organizationId,
      provider: integration as any, // KeyManager treats provider as a string label
      keyType: keyType || "apiKey",
      keyValue,
    });

    await convex.mutation(api.integrationKeys.upsertKey, {
      organizationId,
      integration,
      qualifiedName,
      mcpUrl,
      keyType: keyType || "apiKey",
      keyValue: processedValue,
      storageStrategy: strategy,
    });

    return NextResponse.json({ success: true, strategy });
  } catch (error: any) {
    console.error("[IntegrationKeys] Save error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    const convex = getConvexClient();
    const token = await getToken({ template: "convex" });
    const { organizationId, integration } = await req.json();

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (token) convex.setAuth(token);

    await convex.mutation(api.integrationKeys.removeKey, { organizationId, integration });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
