import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkMembership } from "./authUtils";

const ALGORITHM = "AES-CBC";

// Helper to convert ArrayBuffer to hex string
function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to convert hex string to Uint8Array
function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper to compute SHA-256 hash of a string
async function hashKey(key: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}

// Helper to derive a CryptoKey from the organizationId
async function getSecretKey(orgId: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(orgId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(text: string, orgId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await getSecretKey(orgId);
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  return {
    encryptedKey: toHex(encryptedBuffer),
    iv: toHex(iv.buffer),
  };
}

async function decrypt(encryptedText: string, ivHex: string, orgId: string) {
  const iv = fromHex(ivHex);
  const key = await getSecretKey(orgId);
  const data = fromHex(encryptedText);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decryptedBuffer);
}

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();

    // Decrypt keys for the UI (so we can show prefixes)
    return await Promise.all(keys.map(async k => ({
        ...k,
        key: (k.encryptedKey && k.iv) 
          ? await decrypt(k.encryptedKey, k.iv, k.organizationId as string)
          : ""
    })));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await checkMembership(ctx, args.organizationId);
    
    // Generate raw key
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const rawKey = `sk_${toHex(randomBytes.buffer)}`;
    
    // Encrypt and Hash
    const { encryptedKey, iv } = await encrypt(rawKey, args.organizationId as string);
    const keyHash = await hashKey(rawKey);
    
    return await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      name: args.name,
      keyHash,
      encryptedKey,
      iv,
      corsOrigins: [],
      rateLimit: 60,
      createdAt: Date.now(),
    });
  },
});

export const updateSettings = mutation({
  args: {
    id: v.id("apiKeys"),
    corsOrigins: v.optional(v.array(v.string())),
    rateLimit: v.optional(v.number()),
    defaultModelId: v.optional(v.string()),
    defaultConfigId: v.optional(v.id("databaseConfigs")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Key not found");
    await checkMembership(ctx, existing.organizationId);

    if (args.rateLimit !== undefined && (args.rateLimit < 10 || args.rateLimit > 60)) {
      throw new Error("Rate limit must be between 10 and 60 requests per minute.");
    }

    await ctx.db.patch(args.id, {
      corsOrigins: args.corsOrigins ?? existing.corsOrigins,
      rateLimit: args.rateLimit ?? existing.rateLimit,
      defaultModelId: args.defaultModelId ?? existing.defaultModelId,
      defaultConfigId: args.defaultConfigId ?? existing.defaultConfigId,
    });
  },
});

export const addOrigin = mutation({
  args: { id: v.id("apiKeys"), origin: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Key not found");
    await checkMembership(ctx, existing.organizationId);

    const origins = existing.corsOrigins || [];
    if (!origins.includes(args.origin)) {
      await ctx.db.patch(args.id, {
        corsOrigins: [...origins, args.origin],
      });
    }
  },
});

export const removeOrigin = mutation({
  args: { id: v.id("apiKeys"), origin: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Key not found");
    await checkMembership(ctx, existing.organizationId);

    const origins = existing.corsOrigins || [];
    await ctx.db.patch(args.id, {
      corsOrigins: origins.filter((o) => o !== args.origin),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Key not found");
    await checkMembership(ctx, existing.organizationId);
    await ctx.db.delete(args.id);
  },
});

export const validate = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const keyHash = await hashKey(args.key);
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
      
    if (!apiKey) return null;

    // Check if API is enabled for this org
    const settings = await ctx.db
        .query("developerSettings")
        .withIndex("by_org", (q) => q.eq("organizationId", apiKey.organizationId))
        .unique();
    
    if (settings && !settings.isPublicApiEnabled) return null;

    return {
        organizationId: apiKey.organizationId,
        rateLimit: apiKey.rateLimit || settings?.rateLimitPerMinute || 60,
        corsOrigins: apiKey.corsOrigins || [],
        defaultModelId: apiKey.defaultModelId || (apiKey.preferredAiProvider ? `${apiKey.preferredAiProvider}:latest` : undefined),
        defaultConfigId: apiKey.defaultConfigId
    };
  },
});

export const updateLastUsed = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const keyHash = await hashKey(args.key);
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
    if (apiKey) {
      await ctx.db.patch(apiKey._id, { lastUsedAt: Date.now() });
    }
  },
});

/**
 * Record usage and check rate limit.
 * Returns true if allowed, false if rate limited.
 */
export const recordUsageAndCheckRateLimit = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const keyHash = await hashKey(args.key);
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .unique();

    if (!apiKey) throw new Error("Invalid API Key.");

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 1. Fetch usage in the last minute
    const recentUsage = await ctx.db
      .query("apiKeyUsage")
      .withIndex("by_key_time", (q) =>
        q.eq("apiKeyId", apiKey._id).gt("timestamp", oneMinuteAgo)
      )
      .collect();

    // 2. Check against limit
    const limit = apiKey.rateLimit || 60;
    if (recentUsage.length >= limit) {
      return { allowed: false, current: recentUsage.length, limit };
    }

    // 3. Record new usage
    await ctx.db.insert("apiKeyUsage", {
      apiKeyId: apiKey._id,
      timestamp: now,
    });

    // 4. Update last used as well
    await ctx.db.patch(apiKey._id, { lastUsedAt: now });

    // 5. Prune old records asynchronously (Optional, but good for performance)
    // We'll just do it here for simplicity
    const oldRecords = await ctx.db
      .query("apiKeyUsage")
      .withIndex("by_key_time", (q) =>
        q.eq("apiKeyId", apiKey._id).lt("timestamp", oneMinuteAgo - 60000)
      )
      .take(50);
    for (const old of oldRecords) {
      await ctx.db.delete(old._id);
    }

    return { allowed: true, current: recentUsage.length + 1, limit };
  },
});

