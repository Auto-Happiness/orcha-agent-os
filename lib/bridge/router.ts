import { ToolboxClient } from "@toolbox-sdk/core";

/**
 * The DataBridge is a stateless wrapper around the Google GenAI Toolbox.
 * It allows for multi-tenant tool execution by dynamically resolving
 * database connections per organization.
 */
export class DataBridge {
  private client: ToolboxClient;

  constructor(endpoint: string = process.env.TOOLBOX_URL || "http://localhost:5000") {
    this.client = new ToolboxClient(endpoint);
  }

  /**
   * Executes a tool for a specific organization.
   * In a full implementation, this would handle JIT configuration
   * or proxying to a pool of multi-tenant workers.
   */
  async execute(orgId: string, toolName: string, args: any) {
    console.log(`[Bridge] Executing ${toolName} for Org ${orgId}`);
    
    // 1. Evaluate query size / intent
    const isLargeExport = this.isLargeScaleQuery(toolName, args);

    if (isLargeExport) {
      return { 
        status: "queued", 
        message: "This query is too large for chat. I've started a background CSV export for you.",
        jobType: "csv_export"
      };
    }

    try {
      // 2. Load and Execute the Tool
      const tool = await this.client.loadTool(toolName);
      const result = await tool(args);
      return { status: "success", data: result };
    } catch (error: any) {
      console.error(`[Bridge] Execution failed:`, error);
      return { status: "error", message: error.message };
    }
  }

  /**
   * Heuristic to decide if we should stream to CSV or return JSON.
   */
  private isLargeScaleQuery(toolName: string, args: any): boolean {
    const largeKeywords = ["all", "everything", "export", "dump", "full"];
    const nameMatch = largeKeywords.some(k => toolName.toLowerCase().includes(k));
    
    // Also check if user explicitly requested a high limit or export
    if (args.limit && args.limit > 1000) return true;
    if (args.format === "csv") return true;

    return nameMatch;
  }
}

export const bridge = new DataBridge();
