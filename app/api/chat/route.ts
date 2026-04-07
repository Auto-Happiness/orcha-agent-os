import { NextRequest, NextResponse } from "next/server";
import { streamText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { DbExecutor } from "@/lib/db-executor";
import { KeyManager } from "@/lib/key-manager";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    const { messages, organizationId, configId, modelId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify multi-tenant isolation: User MUST belong to the organization they are querying
    if (orgId !== organizationId) {
       console.error(`[Security] Unauthorized access attempt: User ${userId} tried to access Org ${organizationId}`);
       return NextResponse.json({ error: "Access Denied: You do not belong to this organization." }, { status: 403 });
    }

    // 1. Fetch the semantic models and active config
    let config;
    if (configId) {
      // Fetch specific config if provided
      const allConfigs = await convex.query(api.databaseConfigs.listByOrganization, { organizationId });
      config = allConfigs.find((c: any) => c._id === configId);
    } else {
      // Default logic (first one)
      config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
    }

    if (!config) {
      return NextResponse.json({ error: "Deployment environment not found." }, { status: 400 });
    }

    const semanticModels = await convex.query(api.semanticModels.listModelsByConfig, { configId: config._id });
    const relationships = await convex.query(api.semanticRelationships.listByConfig, { configId: config._id });

    // 1.5 Fetch AI Config and Initialize Requested Model
    const selectedModelStr = modelId || "gemini:gemini-1.5-flash";
    const [provider, modelName] = selectedModelStr.split(":");
    
    const aiKeys = await convex.query(api.aiKeys.listByOrganization, { organizationId });
    
    let aiModel: any;

    if (provider === "openai") {
      const keyRecord = aiKeys.find((k: any) => k.provider === "openai");
      let apiKey = process.env.OPENAI_API_KEY;
      if (keyRecord && keyRecord.keyValue) {
         try {
           apiKey = KeyManager.decrypt(keyRecord.keyValue, organizationId);
         } catch (e) { console.error("Failed to decrypt OpenAI key:", e); }
      }
      if (!apiKey) return NextResponse.json({ error: "OpenAI API key is missing or invalid." }, { status: 400 });
      
      const openai = createOpenAI({ apiKey });
      aiModel = openai(modelName);
    } else {
      // Default to Gemini
      const keyRecord = aiKeys.find((k: any) => k.provider === "gemini");
      let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (keyRecord && keyRecord.keyValue) {
         try {
           apiKey = KeyManager.decrypt(keyRecord.keyValue, organizationId);
         } catch (e) { console.error("Failed to decrypt Gemini key:", e); }
      }
      if (!apiKey) return NextResponse.json({ error: "Gemini API key is missing or invalid." }, { status: 400 });
      
      const google = createGoogleGenerativeAI({ apiKey });
      aiModel = google(modelName || "gemini-1.5-flash");
    }

    // 2. Prepare the System Prompt with Semantic Metadata
    const schemaDescription = semanticModels.map(model => {
      const fields = model.fields.map(f => {
        let fieldDesc = `- ${f.displayName} (${f.columnName}): ${f.type}`;
        if (f.expression) fieldDesc += ` [CALCULATED: ${f.expression}]`;
        if (f.aggregation) fieldDesc += `, aggregation: ${f.aggregation}`;
        if (f.isPrimary) fieldDesc += ` (PRIMARY KEY)`;
        return fieldDesc;
      }).join('\n');
      return `### Table: ${model.displayName} (Physical name: ${model.tableName})\n${fields}`;
    }).join('\n\n');

    const relationshipDescription = relationships && relationships.length > 0
      ? `### Relationships (JOIN Paths):\n` + relationships.map((rel: any) => {
        const fromModel = semanticModels.find(m => m._id === rel.fromModelId);
        const toModel = semanticModels.find(m => m._id === rel.toModelId);
        return `- ${rel.fromColumn} in table ${fromModel?.tableName || 'unknown'} links to ${rel.toColumn} in table ${toModel?.tableName || 'unknown'} (${rel.type})`;
      }).join('\n')
      : "";

    const systemPrompt = `
      You are an expert Data Analyst specializing in ${config.type.toUpperCase()} SQL.
      
      Your goal is to answer the user's data questions by generating and executing SQL queries.
      
      Use the following Semantic Layer definition to understand the database structure:
      ${schemaDescription}

      ${relationshipDescription}

      Rules:
      1. Use the physical table names and column names in your SQL.
      2. If you need to join tables, use the JOIN paths defined in the Relationships section.
      3. For calculated fields, treat the expression as the source of TRUTH for that logic.
      4. If you need to answer a question, use the "execute_sql" tool.
      5. For any SQL you generate, ensure it's compatible with ${config.type.toUpperCase()}.
      6. If the question is ambiguous or impossible, explain why.
    `;

    // 3. Call the LLM with Tools
    const result = await streamText({
      model: aiModel,
      system: systemPrompt,
      messages,
      tools: {
        execute_sql: {
          description: "Executes a SQL query against the connected database and returns the result data.",
          parameters: z.object({
            sql: z.string().describe("The SQL query to execute."),
          }),
          execute: async ({ sql }: { sql: string }) => {
            try {
              const rows = await DbExecutor.execute(config as any, sql);
              return { success: true, data: rows };
            } catch (err: any) {
              return { success: false, error: err.message };
            }
          },
        },
      } as any,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
