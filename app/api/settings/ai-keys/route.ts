import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";
import { auth } from "@clerk/nextjs/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    const { organizationId, provider, keyType, keyValue } = await req.json();

    if (!userId || orgId !== organizationId) {
       return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // Use KeyManager to determine how and what to store
    const { processedValue, strategy } = await KeyManager.prepareForStorage({
      organizationId,
      provider,
      keyType: keyType || "apiKey",
      keyValue
    });

    // Save metadata and processed value to Convex
    await convex.mutation(api.aiKeys.upsertKey, {
      organizationId,
      provider,
      keyType: keyType || "apiKey",
      keyValue: processedValue,
      storageStrategy: strategy
    });

    return NextResponse.json({ success: true, strategy });
  } catch (error: any) {
    console.error("[Settings/API] Key Storage Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    const { organizationId, provider } = await req.json();

    if (!userId || orgId !== organizationId) {
       return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    await convex.mutation(api.aiKeys.removeKey, { organizationId, provider });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
