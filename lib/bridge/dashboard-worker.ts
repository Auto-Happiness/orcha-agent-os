import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { resolveModel } from "@/lib/model-resolver";
import { pruneColumns, getPruningModelId } from "@/lib/column-pruner";
import { generateObject } from "ai";
import { z } from "zod";
import { getNativeDialectRule } from "@/lib/dialects";
import { getServerConvexUrl } from "@/lib/server-convex-url";

// Zod Schema for strict AI responses matching Mantine and dashboard widgets
const proposedWidgetSchema = z.object({
  type: z.enum(["bar", "line", "pie", "kpi", "table", "counter", "area", "radar"]),
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

export class DashboardWorker {
  private redis: IORedis;
  private workerRedis?: IORedis;
  private queue: Queue;
  private worker?: Worker;

  constructor(isWorker: boolean = false) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue("dashboard-generation", { connection: this.redis });

    if (isWorker) {
      console.log(`🚀 [DashboardWorker] Consumer initialized. Listening for jobs...`);
      this.workerRedis = new IORedis(redisUrl, { maxRetriesPerRequest: null });

      this.worker = new Worker(
        "dashboard-generation",
        async (job) => {
          console.log(`\n📦 [DashboardWorker] RECEIVED NEW JOB: ${job.id}`);
          const { proposalId, draftPrompts, configIds, selectedModel, organizationId, clerkToken } = job.data;

          const convex = new ConvexHttpClient(getServerConvexUrl());
          if (clerkToken) convex.setAuth(clerkToken);

          try {
            // Fetch database configurations & organization keys inside worker
            const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
            const aiKeys = await convex.query(api.aiKeys.listByOrganization, { organizationId });

            // Build mapping for aliases
            const configMap = new Map<string, any>();
            allConfigs.forEach(c => {
              const alias = c.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
              configMap.set(c._id, { ...c, alias });
            });

            console.log(`📊 [DashboardWorker] Running generation for proposal ${proposalId}...`);
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
            console.log(`✅ [DashboardWorker] JOB COMPLETED: ${job.id}`);
            return { success: true };
          } catch (error: any) {
            console.error(`❌ [DashboardWorker] JOB FAILED (${job.id}):`, error?.stack || error?.message || error);
            try {
              await convex.mutation(api.bi.updateProposal, {
                proposalId,
                status: "failed",
                error: error.message || "Unknown background error",
              });
            } catch (mutationErr: any) {
              console.error("[DashboardWorker] Failed to write error back to Convex:", mutationErr.message);
            }
            throw error;
          }
        },
        { connection: this.workerRedis, concurrency: 5 }
      );

      this.worker.on("failed", (job, err) => {
        console.error(`[DashboardWorker] Worker failed job ${job?.id}:`, err.message);
      });
    }
  }

  async addJob(data: any) {
    return await this.queue.add("dashboard-generation-job", data, {
      removeOnComplete: {
        count: 100,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 500,
      },
    });
  }

  async close() {
    if (this.worker) await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
    if (this.workerRedis) await this.workerRedis.quit();
  }
}

let globalDashboardWorker: DashboardWorker | null = null;

export function getDashboardWorker(isWorker = false) {
  if (!globalDashboardWorker) {
    globalDashboardWorker = new DashboardWorker(isWorker);
  }
  return globalDashboardWorker;
}

/**
 * Handles the actual LLM generation, RAG, column pruning, and SQL mapping.
 */
export async function executeGeneration({
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

  // Get the target database dialect rule if we are generating for a single database config
  const singleConfigId = configIds.length === 1 ? configIds[0] : null;
  const singleConfig = singleConfigId ? configMap.get(singleConfigId) : null;
  const dialectRule = singleConfig 
    ? getNativeDialectRule(singleConfig.type) 
    : "- Native Dialect: Standard SQL.";

  // 2. Perform intelligent column pruning to stay well within token limits
  const consolidatedQuestion = draftPrompts.map(p => `[${p.type}] ${p.text}`).join(" | ");
  let prunedModels = combinedModels;
  try {
    const pruningModelId = getPruningModelId(selectedModel);
    const pruningModel = resolveModel(pruningModelId, aiKeys, organizationId as string);

    prunedModels = await pruneColumns(
      consolidatedQuestion,
      combinedModels,
      combinedRelationships,
      pruningModel
    );
  } catch (err: any) {
    console.warn(`⚠️ [DashboardWorker] Column pruning failed: ${err.message || err}. Falling back to full schema.`);
  }

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
    3. Generate valid SQL queries matching the target database dialect rules:
       ${dialectRule}
       Ensure dates and times are formatted appropriately (e.g. using DATE_FORMAT for MySQL, TO_CHAR for Postgres, etc.) as required by the native dialect.
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

  // 5. Generate structured object with self-healing fallback
  let responseWidgets;
  try {
    const { object } = await generateObject({
      model,
      schema: dashboardGenerationSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
    });
    responseWidgets = object.widgets;
  } catch (err: any) {
    console.error(`⚠️ [DashboardWorker] Main generation failed with ${selectedModel}:`, err.message || err);
    
    // Check if we can fall back to Gemini or OpenAI
    const hasKey = (provider: string) => aiKeys.some(k => k.provider === provider && k.keyValue);
    let fallbackModelId = "";
    if (hasKey("gemini")) {
      fallbackModelId = "gemini:gemini-1.5-flash";
    } else if (hasKey("openai")) {
      fallbackModelId = "openai:gpt-4o-mini";
    }

    if (fallbackModelId && fallbackModelId !== selectedModel) {
      console.log(`🔄 [DashboardWorker] Attempting self-healing fallback to: ${fallbackModelId}`);
      const fallbackModel = resolveModel(fallbackModelId, aiKeys, organizationId as string);
      
      const { object } = await generateObject({
        model: fallbackModel,
        schema: dashboardGenerationSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.2,
      });
      responseWidgets = object.widgets;
    } else {
      // Re-throw the original error if no fallback is available
      throw err;
    }
  }

  return responseWidgets;
}
