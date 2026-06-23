import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { parseDbtProject } from "@/lib/dbt-parser";
import { compileToMdl } from "@/lib/semantic-compiler";
import { KeyManager } from "@/lib/key-manager";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

export async function POST(req: NextRequest) {
  const convex = getConvexClient();
  try {
    const body = await req.json();
    const { organizationId, configId, manifest, catalog } = body;

    if (!organizationId || !configId || !manifest) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: organizationId, configId, manifest." },
        { status: 400 }
      ) as any;
    }

    // Attach Clerk token so Convex auth-gated queries work from server
    const clerkAuth = await auth();
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // 1. Parse dbt manifest and catalog
    console.log(`[ImportDbt] Parsing dbt project with organizationId ${organizationId}, configId ${configId}`);
    const parsed = parseDbtProject(manifest, catalog);
    console.log(`[ImportDbt] Parsed ${parsed.models.length} models and ${parsed.relationships.length} relationships`);

    // 2. Perform bulk import into Convex V1 models/relationships tables
    const importResult = await convex.mutation(api.semanticModels.bulkImportDbt, {
      organizationId,
      configId,
      models: parsed.models,
      relationships: parsed.relationships,
    });

    // 3. Compile updated semantic state to MDL manifest
    console.log(`[ImportDbt] Rebuilding MDL manifest...`);
    const [allConfigs, v1Models, v1Rels] = await Promise.all([
      convex.query(api.databaseConfigs.listByOrganization, { organizationId }),
      convex.query(api.semanticModels.listModelsByConfig, { configId }),
      convex.query(api.semanticRelationships.listByConfig, { configId }),
    ]);

    const mdl = compileToMdl(v1Models, v1Rels, configId, allConfigs);

    // 4. Save compiled V2 MDL manifest
    await convex.mutation(api.mdlManifests.save, {
      organizationId,
      configId,
      catalog: mdl.catalog,
      schema: mdl.schema,
      models: mdl.models,
      relationships: mdl.relationships,
      views: mdl.views,
    });

    // 5. Trigger background vector indexing for the MDL manifest
    let indexed = false;
    try {
      const allKeys = await convex.query(api.aiKeys.listByOrganization, { organizationId });
      const preferredKey = allKeys.find((k: any) => k.provider === "openai" || k.provider === "gemini");

      if (preferredKey) {
        let plaintextKey = preferredKey.keyValue;
        if (preferredKey.storageStrategy === "convex" || !preferredKey.storageStrategy) {
          plaintextKey = KeyManager.decrypt(preferredKey.keyValue, organizationId);
        }

        await convex.action(api.embeddings.indexMdlManifest, {
          organizationId,
          configId,
          provider: preferredKey.provider as "openai" | "gemini",
          apiKey: plaintextKey,
        });
        indexed = true;
      }
    } catch (err: any) {
      console.error(`[ImportDbt] Vector indexing failed:`, err.message);
    }

    return NextResponse.json({
      success: true,
      modelsCount: parsed.models.length,
      relationshipsCreated: importResult.relationshipsCreated,
      vectorIndexed: indexed,
    }) as any;

  } catch (err: any) {
    console.error(`[ImportDbt] API Error:`, err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to process dbt import." },
      { status: 500 }
    ) as any;
  }
}
