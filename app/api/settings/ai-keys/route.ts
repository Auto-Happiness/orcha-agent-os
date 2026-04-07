import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { KeyManager } from "@/lib/key-manager";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { organizationId, provider, keyType, keyValue } = await req.json();

    if (!organizationId || !provider || !keyValue) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
    const { organizationId, provider } = await req.json();

    if (!organizationId || !provider) {
       return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await convex.mutation(api.aiKeys.removeKey, { organizationId, provider });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
