import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkMembership } from "./authUtils";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";

// Helper to derive a 32-byte key from the organizationId
function getSecretKey(orgId: string) {
  return createHash("sha256").update(orgId).digest();
}

function encrypt(text: string, orgId: string) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(orgId), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    encryptedKey: encrypted,
    iv: iv.toString("hex"),
  };
}

function decrypt(encryptedText: string, ivHex: string, orgId: string) {
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getSecretKey(orgId), iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
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
    return keys.map(k => ({
        ...k,
        key: decrypt(k.encryptedKey, k.iv, k.organizationId as string)
    }));
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
    const rawKey = `sk_${randomBytes(16).toString("hex")}`;
    
    // Encrypt and Hash
    const { encryptedKey, iv } = encrypt(rawKey, args.organizationId as string);
    const keyHash = hashKey(rawKey);
    
    return await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      name: args.name,
      keyHash,
      encryptedKey,
      iv,
      createdAt: Date.now(),
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
    const keyHash = hashKey(args.key);
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
        rateLimit: settings?.rateLimitPerMinute || 60
    };
  },
});

export const updateLastUsed = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const keyHash = hashKey(args.key);
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
    if (apiKey) {
      await ctx.db.patch(apiKey._id, { lastUsedAt: Date.now() });
    }
  },
});
