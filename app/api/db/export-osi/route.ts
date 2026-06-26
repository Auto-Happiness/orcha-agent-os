// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const configId = searchParams.get("configId");
  const organizationId = searchParams.get("organizationId");

  if (!configId || !organizationId) {
    return NextResponse.json(
      { success: false, message: "Missing required query parameters: configId, organizationId." },
      { status: 400 }
    ) as any;
  }

  const convex = getConvexClient();

  try {
    // Attach Clerk token so Convex auth-gated queries work from server
    const clerkAuth = await auth();
    const token = await clerkAuth.getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // 1. Fetch config, models, relationships, and instructions from Convex
    const [config, models, relationships, instructions] = await Promise.all([
      convex.query(api.databaseConfigs.getById, { configId: configId as any }),
      convex.query(api.semanticModels.listModelsByConfig, { configId: configId as any }),
      convex.query(api.semanticRelationships.listByConfig, { configId: configId as any }),
      convex.query(api.semanticInstructions.listByConfig, { configId: configId as any }),
    ]);

    if (!config) {
      return NextResponse.json(
        { success: false, message: "Database configuration not found." },
        { status: 404 }
      ) as any;
    }

    // 2. Build model ID to tableName lookup map
    const modelIdToName = new Map<string, string>();
    for (const m of models) {
      modelIdToName.set(m._id, m.tableName);
    }

    // 3. Serialize to Open Semantic Interchange (OSI) YAML format (v0.2.0)
    let yaml = `version: "0.2.0"\n`;
    yaml += `semantic_model:\n`;
    yaml += `  - name: "${config.name.replace(/"/g, '\\"')}"\n`;

    // Serialize Instructions
    if (instructions && instructions.length > 0) {
      yaml += `    ai_context:\n`;
      yaml += `      instructions: |\n`;
      for (const inst of instructions) {
        const title = inst.title || "Instruction";
        const content = inst.content || "";
        yaml += `        ## ${title}\n`;
        // Indent content lines for block literal
        const indentedContent = content
          .split("\n")
          .map((line: string) => `        ${line}`)
          .join("\n");
        yaml += `${indentedContent}\n\n`;
      }
    }

    // Serialize Models/Datasets
    if (models && models.length > 0) {
      yaml += `    datasets:\n`;
      for (const model of models) {
        yaml += `      - name: "${model.tableName}"\n`;
        yaml += `        source: "${model.tableName}"\n`;

        const primaryKeys = (model.fields || [])
          .filter((f: any) => f.isPrimary)
          .map((f: any) => `"${f.columnName}"`);

        if (primaryKeys.length > 0) {
          yaml += `        primary_key: [${primaryKeys.join(", ")}]\n`;
        }

        if (model.fields && model.fields.length > 0) {
          yaml += `        fields:\n`;
          for (const field of model.fields) {
            yaml += `          - name: "${field.columnName}"\n`;
            yaml += `            expression: "${field.columnName}"\n`;
            if (field.description) {
              yaml += `            description: "${field.description.replace(/"/g, '\\"')}"\n`;
            }
            if (field.dataType) {
              yaml += `            data_type: "${field.dataType}"\n`;
            }
          }
        }
      }
    }

    // Serialize Relationships
    if (relationships && relationships.length > 0) {
      yaml += `    relationships:\n`;
      for (const rel of relationships) {
        const fromTable = modelIdToName.get(rel.fromModelId) || "unknown";
        const toTable = modelIdToName.get(rel.toModelId) || "unknown";

        yaml += `      - name: "${rel.name || `${fromTable}_to_${toTable}`}"\n`;
        yaml += `        from: "${fromTable}"\n`;
        yaml += `        to: "${toTable}"\n`;
        yaml += `        from_columns: ["${rel.fromColumn}"]\n`;
        yaml += `        to_columns: ["${rel.toColumn}"]\n`;
      }
    }

    // 4. Generate environment specific filename: environment_name-(configId).yaml
    const safeEnvName = config.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const filename = `${safeEnvName}-${configId}.yaml`;

    // 5. Send downloadable file response
    return new Response(yaml, {
      status: 200,
      headers: {
        "Content-Type": "application/x-yaml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });

  } catch (err: any) {
    console.error(`[ExportOsi] Export API Error:`, err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to compile OSI export." },
      { status: 500 }
    ) as any;
  }
}
