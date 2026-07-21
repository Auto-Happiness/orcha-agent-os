import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";
import { auth } from "../auth-helper";
import { KeyManager } from "../key-manager";
import { checkRateLimit } from "../rate-limiter";
import { POST as aiKeysPost, DELETE as aiKeysDelete } from "../../app/api/settings/ai-keys/route";
import { POST as integrationKeysPost, DELETE as integrationKeysDelete } from "../../app/api/settings/integration-keys/route";

// Store originals
const originalQuery = ConvexHttpClient.prototype.query;
const originalMutation = ConvexHttpClient.prototype.mutation;
const originalGetAuth = auth.getAuth;
const originalEnvKey = process.env.ENCRYPTION_KEY;
const originalKeyStorage = process.env.KEY_STORAGE;

describe("Developer API Tests", () => {
  before(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://localhost:3000";
    process.env.ENCRYPTION_KEY = "12345678901234567890123456789012"; // 32 chars
  });

  beforeEach(() => {
    ConvexHttpClient.prototype.query = originalQuery;
    ConvexHttpClient.prototype.mutation = originalMutation;
    auth.getAuth = originalGetAuth;
    process.env.KEY_STORAGE = "convex";
  });

  after(() => {
    ConvexHttpClient.prototype.query = originalQuery;
    ConvexHttpClient.prototype.mutation = originalMutation;
    auth.getAuth = originalGetAuth;
    process.env.ENCRYPTION_KEY = originalEnvKey;
    process.env.KEY_STORAGE = originalKeyStorage;

    // Clean up local .vault if created during tests
    const vaultPath = path.join(process.cwd(), ".vault");
    if (fs.existsSync(vaultPath)) {
      try {
        fs.rmSync(vaultPath, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  });

  describe("KeyManager", () => {
    test("should encrypt and decrypt successfully with the correct orgId", () => {
      const orgId = "org_123";
      const secretText = "my-secret-api-key";
      const encrypted = KeyManager.encrypt(secretText, orgId);
      assert.notEqual(encrypted, secretText);

      const decrypted = KeyManager.decrypt(encrypted, orgId);
      assert.strictEqual(decrypted, secretText);
    });

    test("should fail decryption with the wrong orgId", () => {
      const orgId1 = "org_123";
      const orgId2 = "org_456";
      const secretText = "my-secret-api-key";
      const encrypted = KeyManager.encrypt(secretText, orgId1);

      assert.throws(() => {
        KeyManager.decrypt(encrypted, orgId2);
      });
    });

    test("should prepare for storage using 'convex' strategy (default)", async () => {
      const payload = {
        organizationId: "org_123",
        provider: "openai",
        keyType: "apiKey",
        keyValue: "secret-key-123"
      };

      const result = await KeyManager.prepareForStorage(payload);
      assert.strictEqual(result.strategy, "convex");
      assert.notEqual(result.processedValue, payload.keyValue);

      const decrypted = KeyManager.decrypt(result.processedValue, payload.organizationId);
      assert.strictEqual(decrypted, payload.keyValue);
    });

    test("should prepare for storage using 'json' strategy", async () => {
      process.env.KEY_STORAGE = "json";
      const payload = {
        organizationId: "org_123",
        provider: "anthropic",
        keyType: "apiKey",
        keyValue: "anthropic-secret-key"
      };

      const result = await KeyManager.prepareForStorage(payload);
      assert.strictEqual(result.strategy, "json");
      assert.strictEqual(result.processedValue, "stored_locally");

      // Verify the file was written
      const vaultFile = path.join(process.cwd(), ".vault", "keys.json");
      assert.ok(fs.existsSync(vaultFile));
      const content = JSON.parse(fs.readFileSync(vaultFile, "utf-8"));
      assert.ok(content["org_123_anthropic"]);
      assert.strictEqual(content["org_123_anthropic"].keyValue, "anthropic-secret-key");
    });

    test("should prepare for storage using 'aws_kms' strategy", async () => {
      process.env.KEY_STORAGE = "aws_kms";
      const payload = {
        organizationId: "org_123",
        provider: "google",
        keyType: "apiKey",
        keyValue: "google-secret-key"
      };

      const result = await KeyManager.prepareForStorage(payload);
      assert.strictEqual(result.strategy, "aws_kms");
      assert.strictEqual(result.processedValue, "kms_org_org_123:google-secret-key");
    });
  });

  describe("Rate Limiter", () => {
    test("should allow requests up to the limit and then rate limit", async () => {
      const orgId = "org_rate_limit_test";
      const limit = 3;

      // 3 successful requests
      let res = await checkRateLimit(orgId, limit);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.remaining, 2);

      res = await checkRateLimit(orgId, limit);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.remaining, 1);

      res = await checkRateLimit(orgId, limit);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.remaining, 0);

      // 4th request should fail
      res = await checkRateLimit(orgId, limit);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.remaining, 0);
    });
  });

  describe("AI Keys API Route (/api/settings/ai-keys)", () => {
    test("POST returns 401 Unauthorized if not logged in", async () => {
      auth.getAuth = async () => ({
        userId: null,
        orgId: null,
        getToken: async () => null,
      } as any);

      const req = new NextRequest("http://localhost/api/settings/ai-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_123",
          provider: "openai",
          keyType: "apiKey",
          keyValue: "test-key"
        }),
      });

      const res = await aiKeysPost(req);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, "Unauthorized");
    });

    test("POST saves key successfully when logged in", async () => {
      auth.getAuth = async () => ({
        userId: "user_123",
        orgId: "org_123",
        getToken: async () => "token_123",
      } as any);

      let mutationCalled = false;
      ConvexHttpClient.prototype.mutation = async (mutationRef: any, args: any) => {
        mutationCalled = true;
        assert.strictEqual(args.organizationId, "org_123");
        assert.strictEqual(args.provider, "openai");
        assert.strictEqual(args.keyType, "apiKey");
        assert.ok(args.keyValue); // encrypted
        assert.strictEqual(args.storageStrategy, "convex");
        return {};
      };

      const req = new NextRequest("http://localhost/api/settings/ai-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_123",
          provider: "openai",
          keyType: "apiKey",
          keyValue: "test-key"
        }),
      });

      const res = await aiKeysPost(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.strategy, "convex");
      assert.ok(mutationCalled);
    });

    test("DELETE removes key successfully when logged in", async () => {
      auth.getAuth = async () => ({
        userId: "user_123",
        orgId: "org_123",
        getToken: async () => "token_123",
      } as any);

      let mutationCalled = false;
      ConvexHttpClient.prototype.mutation = async (mutationRef: any, args: any) => {
        mutationCalled = true;
        assert.strictEqual(args.organizationId, "org_123");
        assert.strictEqual(args.provider, "openai");
        return {};
      };

      const req = new NextRequest("http://localhost/api/settings/ai-keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_123",
          provider: "openai"
        }),
      });

      const res = await aiKeysDelete(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(mutationCalled);
    });
  });

  describe("Integration Keys API Route (/api/settings/integration-keys)", () => {
    test("POST returns 401 Unauthorized if not logged in", async () => {
      auth.getAuth = async () => ({
        userId: null,
        orgId: null,
        getToken: async () => null,
      } as any);

      const req = new NextRequest("http://localhost/api/settings/integration-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_123",
          integration: "slack",
          keyType: "apiKey",
          keyValue: "test-key"
        }),
      });

      const res = await integrationKeysPost(req);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, "Unauthorized");
    });

    test("POST saves key successfully when logged in", async () => {
      auth.getAuth = async () => ({
        userId: "user_123",
        orgId: "org_123",
        getToken: async () => "token_123",
      } as any);

      let mutationCalled = false;
      ConvexHttpClient.prototype.mutation = async (mutationRef: any, args: any) => {
        mutationCalled = true;
        assert.strictEqual(args.organizationId, "org_123");
        assert.strictEqual(args.integration, "slack");
        assert.strictEqual(args.keyType, "apiKey");
        assert.ok(args.keyValue); // encrypted
        assert.strictEqual(args.storageStrategy, "convex");
        return {};
      };

      const req = new NextRequest("http://localhost/api/settings/integration-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_123",
          integration: "slack",
          keyType: "apiKey",
          keyValue: "test-key"
        }),
      });

      const res = await integrationKeysPost(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.strategy, "convex");
      assert.ok(mutationCalled);
    });

    test("DELETE removes key successfully when logged in", async () => {
      auth.getAuth = async () => ({
        userId: "user_123",
        orgId: "org_123",
        getToken: async () => "token_123",
      } as any);

      let mutationCalled = false;
      ConvexHttpClient.prototype.mutation = async (mutationRef: any, args: any) => {
        mutationCalled = true;
        assert.strictEqual(args.organizationId, "org_123");
        assert.strictEqual(args.integration, "slack");
        return {};
      };

      const req = new NextRequest("http://localhost/api/settings/integration-keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_123",
          integration: "slack"
        }),
      });

      const res = await integrationKeysDelete(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(mutationCalled);
    });
  });
});
