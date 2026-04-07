import { NextRequest, NextResponse } from "next/server";
import { streamText, tool } from "ai";
import { google } from "@ai-sdk/google";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { DbExecutor } from "@/lib/db-executor";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { messages, organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    // 1. Fetch the semantic models and active config
    const config = await convex.query(api.databaseConfigs.getByOrganization, { organizationId });
    if (!config) {
      return NextResponse.json({ error: "No database connected for this organization." }, { status: 400 });
    }

    const semanticModels = await convex.query(api.semanticModels.listModelsByConfig, { configId: config._id });
    const relationships = await convex.query(api.semanticRelationships.listByConfig, { configId: config._id });

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
      model: google("gemini-1.5-flash"),
      system: systemPrompt,
      messages,
      tools: {
        execute_sql: tool({
          description: "Executes a SQL query against the connected database and returns the result data.",
          parameters: z.object({
            sql: z.string().describe("The SQL query to execute."),
          }),
          execute: async ({ sql }) => {
             try {
                const rows = await DbExecutor.execute(config as any, sql);
                return { success: true, data: rows };
             } catch (err: any) {
                return { success: false, error: err.message };
             }
          },
        }),
      },
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
