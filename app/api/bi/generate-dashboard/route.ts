import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { resolveModel } from "@/lib/model-resolver";
import { pruneColumns, getPruningModelId } from "@/lib/column-pruner";
import { generateObject } from "ai";
import { z } from "zod";

// Zod Schema for strict AI responses matching Mantine and dashboard widgets
const proposedWidgetSchema = z.object({
  type: z.enum(["bar", "line", "pie", "kpi", "table", "counter"]),
  title: z.string(),
  reason: z.string(),
  sql: z.string(),
  mapping: z.object({
    labelKey: z.string(),
    valueKeys: z.array(z.string()),
  }),
});

const dashboardGenerationSchema = z.object({
  widgets: z.array(proposedWidgetSchema),
});

export async function POST(req: NextRequest) {
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

      // Run background execution
      (async () => {
        try {
          const widgets = await executeGeneration({
            draftPrompts,
            configIds,
            selectedModel,
            organizationId,
            convex,

            configMap,
            aiKeys,
          });

          await convex.mutation(api.bi.updateProposal, {
            proposalId,
            status: "ready",
            widgets,
          });
          console.log(`[Dashboard Generator] ASYNC SUCCESS: Proposal ${proposalId} updated.`);
        } catch (err: any) {
          console.error(`[Dashboard Generator] ASYNC FAILURE:`, err);
          await convex.mutation(api.bi.updateProposal, {
            proposalId,
            status: "failed",
            error: err.message || "Unknown background error",
          });
        }
      })();

      return NextResponse.json({
        success: true,
        mode: "async",
        proposalId,
      });
    }

    // ── SYNC MODE: Block and return results ──
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

/**
 * Handles the actual LLM generation, RAG, column pruning, and SQL mapping.
 */
async function executeGeneration({
  draftPrompts,
  configIds,
  selectedModel,
  organizationId,
  convex,
  configMap,
  aiKeys,
}: {
  draftPrompts: { text: string; type: string }[];
  configIds: string[];
  selectedModel: string;
  organizationId: Id<"organizations">;
  convex: ConvexHttpClient;
  configMap: Map<string, any>;
  aiKeys: any[];
}) {
  const model = resolveModel(selectedModel, aiKeys, organizationId as string);

  // 1. Fetch semantic tables and relationships across all selected database configurations
  let combinedModels: any[] = [];
  let combinedRelationships: any[] = [];

  for (const cid of configIds) {
    const config = configMap.get(cid);
    if (!config) continue;

    const models = await convex.query(api.semanticModels.listModelsByConfig, { configId: cid as any });
    const relationships = await convex.query(api.semanticRelationships.listByConfig, { configId: cid as any });

    // Inject database aliases to physical table names to ensure LLM generates correct federated queries
    const mappedModels = (models || []).map((m: any) => ({
      ...m,
      tableName: `${config.alias}.${m.tableName}`,
    }));

    combinedModels.push(...mappedModels);
    combinedRelationships.push(...(relationships || []));
  }

  // 2. Perform intelligent column pruning to stay well within token limits
  const consolidatedQuestion = draftPrompts.map(p => `[${p.type}] ${p.text}`).join(" | ");
  const pruningModelId = getPruningModelId(selectedModel);
  const pruningModel = resolveModel(pruningModelId, aiKeys, organizationId as string);

  const prunedModels = await pruneColumns(
    consolidatedQuestion,
    combinedModels,
    combinedRelationships,
    pruningModel
  );

  // 3. Construct detailed schema DDL for the prompt
  const schemaCatalog = prunedModels.map((m: any) => {
    const cols = m.fields.map((f: any) => {
      const typeHint = f.type === "measure" ? "[MEASURE - numeric, use in valueKeys]"
        : f.isPrimary ? "[PRIMARY KEY - NEVER use as labelKey]"
          : f.type?.toLowerCase().includes("int") || f.type?.toLowerCase().includes("id") ? "[ID/NUMERIC - avoid as labelKey]"
            : "[DIMENSION - good candidate for labelKey if it contains human-readable text]";
      return `  - ${f.columnName} (${f.type || "unknown"}): ${f.description || f.displayName || ""} ${typeHint}`;
    }).join("\n");
    return `### Table: ${m.tableName}\n${m.description || ""}\nColumns:\n${cols}`;
  }).join("\n\n");

  const relationshipCatalog = combinedRelationships.map((r: any) => {
    const fromModel = combinedModels.find(m => m._id === r.fromModelId);
    const toModel = combinedModels.find(m => m._id === r.toModelId);
    if (!fromModel || !toModel) return "";
    return `- ${fromModel.tableName}.${r.fromColumn} references ${toModel.tableName}.${r.toColumn}`;
  }).filter(Boolean).join("\n");

  // 4. Construct the prompt
  const systemPrompt = `
    You are Orcha Genie, a highly skilled BI Architect.
    Your task is to design a set of dashboard widgets based on the user's requested insights and the available database schema.
    
    ### INSTRUCTIONS ###
    1. For each requested insight in the list, design one high-fidelity widget.
    2. Respect the user's requested chart type ("type").
    3. Generate standard, valid DuckDB SQL queries that will execute cleanly against the schema.
    4. CRITICAL: Use the exact table names provided (prefixed with their aliases, e.g., \`alias.table_name\`). Do not invent or assume any tables or columns outside the schema catalog.
    5. Map the results correctly in the "mapping" field:
       - "labelKey": the SQL column ALIAS that contains HUMAN-READABLE category names (e.g. customer name, product name, month, category). NEVER use ID or integer columns as labelKey.
       - "valueKeys": an array of SQL column ALIASES for numerical measures only (e.g. total_sales, order_count).
    6. SQL ALIASING RULES (CRITICAL):
       - ALWAYS use AS aliases in your SELECT for every output column so labelKey and valueKeys map cleanly.
       - Example: SELECT c.customer_name AS customer_name, SUM(o.total) AS total_sales FROM ...
       - The labelKey and valueKeys you specify MUST exactly match the SQL AS aliases you defined.
       - If you must JOIN to get a name column (e.g. customer_name from customers table instead of customer_id from orders), DO the JOIN.
    7. Provide a concise, professional business reasoning ("reason") explaining why this chart is useful.
    
    ### SCHEMA CATALOG ###
    ${schemaCatalog}
    
    ### RELATIONSHIPS ###
    ${relationshipCatalog}
  `;

  const userPrompt = `
    Design widgets for these ${draftPrompts.length} insight requests:
    ${draftPrompts.map((p, i) => `${i + 1}. [Type: ${p.type}] "${p.text}"`).join("\n")}
  `;

  // 5. Generate structured object
  const { object } = await generateObject({
    model,
    schema: dashboardGenerationSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.2,
  });

  return object.widgets;
}
