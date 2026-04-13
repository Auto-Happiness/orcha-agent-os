import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Public action called by serverless functions (Next.js API routes)
 * to save integration keys. Protected by a shared secret.
 */
export const saveKeyWithSecret = action({
  args: {
    secret: v.string(),
    organizationId: v.id("organizations"),
    integration: v.string(),
    keyType: v.string(),
    keyValue: v.string(),
    storageStrategy: v.string(),
  },
  handler: async (ctx, args) => {
    // Basic shared secret check to prevent unauthorized public calls
    const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
    if (!internalSecret || args.secret !== internalSecret) {
      console.error("[ConvexAction] Unauthorized attempt to saveKeyWithSecret");
      throw new Error("Unauthorized");
    }

    // Call the internal mutation which skips membership check
    await ctx.runMutation(internal.integrationKeys.upsertKeyInternal, {
      organizationId: args.organizationId,
      integration: args.integration,
      keyType: args.keyType,
      keyValue: args.keyValue,
      storageStrategy: args.storageStrategy,
    });

    return { success: true };
  },
});
