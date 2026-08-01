// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { getServerConvexUrl } from "@/lib/server-convex-url";

function getConvexClient() {
  const url = getServerConvexUrl();
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

    // 1. Fetch config, models, and relationships from Convex
    const [config, models, relationships] = await Promise.all([
      convex.query(api.databaseConfigs.getById, { configId: configId as any }),
      convex.query(api.semanticModels.listModelsByConfig, { configId: configId as any }),
      convex.query(api.semanticRelationships.listByConfig, { configId: configId as any }),
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

    // 3. Build relationship lookup map grouped by child table & column
    // Key format: "child_table_name|child_column_name" -> array of targets
    const relationshipMap = new Map<string, { toTable: string; toColumn: string }[]>();
    for (const rel of relationships) {
      const fromTable = modelIdToName.get(rel.fromModelId);
      const toTable = modelIdToName.get(rel.toModelId);
      
      if (fromTable && toTable) {
        const key = `${fromTable.toLowerCase()}|${rel.fromColumn.toLowerCase()}`;
        if (!relationshipMap.has(key)) {
          relationshipMap.set(key, []);
        }
        relationshipMap.get(key)!.push({
          toTable,
          toColumn: rel.toColumn,
        });
      }
    }

    // 4. Serialize to standard dbt schema.yml format (version 2)
    let yml = `version: 2\n\n`;
    yml += `models:\n`;

    for (const model of models) {
      yml += `  - name: "${model.tableName}"\n`;
      if (model.description) {
        yml += `    description: "${model.description.replace(/"/g, '\\"')}"\n`;
      }

      if (model.fields && model.fields.length > 0) {
        yml += `    columns:\n`;
        for (const field of model.fields) {
          yml += `      - name: "${field.columnName}"\n`;
          if (field.description) {
            yml += `        description: "${field.description.replace(/"/g, '\\"')}"\n`;
          }

          // Fetch relationships tests where this table/column is the child
          const relsKey = `${model.tableName.toLowerCase()}|${field.columnName.toLowerCase()}`;
          const relsForCol = relationshipMap.get(relsKey);

          const hasTests = field.isPrimary || (relsForCol && relsForCol.length > 0);
          if (hasTests) {
            yml += `        tests:\n`;
            if (field.isPrimary) {
              yml += `          - unique\n`;
              yml += `          - not_null\n`;
            }
            if (relsForCol) {
              for (const rel of relsForCol) {
                yml += `          - relationships:\n`;
                yml += `              to: ref('${rel.toTable}')\n`;
                yml += `              field: ${rel.toColumn}\n`;
              }
            }
          }
        }
      }
      yml += `\n`;
    }

    // 5. Generate environment specific filename: environment_name-dbt-schema-(configId).yml
    const safeEnvName = config.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const filename = `${safeEnvName}-dbt-schema-${configId}.yml`;

    // 6. Send downloadable file response
    return new Response(yml, {
      status: 200,
      headers: {
        "Content-Type": "application/x-yaml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });

  } catch (err: any) {
    console.error(`[ExportDbt] native dbt Export API Error:`, err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to compile native dbt export." },
      { status: 500 }
    ) as any;
  }
}
