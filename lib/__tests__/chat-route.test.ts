import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "../auth-helper";
import { agentHelper } from "../agent-helper";
import { POST } from "../../app/api/chat/route";

// Store original methods for teardown
const originalQuery = ConvexHttpClient.prototype.query;
const originalMutation = ConvexHttpClient.prototype.mutation;
const originalGetAuth = auth.getAuth;
const originalCreateChatAgent = agentHelper.createChatAgent;

describe("Chat Route End-to-End API Handler Tests", () => {
  beforeEach(() => {
    // Reset stubs before each test
    ConvexHttpClient.prototype.query = originalQuery;
    ConvexHttpClient.prototype.mutation = originalMutation;
    auth.getAuth = originalGetAuth;
    agentHelper.createChatAgent = originalCreateChatAgent;
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://localhost:3000";
    process.env.ASYNC = "off";
  });

  after(() => {
    // Restore everything after all tests complete
    ConvexHttpClient.prototype.query = originalQuery;
    ConvexHttpClient.prototype.mutation = originalMutation;
    auth.getAuth = originalGetAuth;
    agentHelper.createChatAgent = originalCreateChatAgent;
  });

  test("1. Returns 401 Unauthorized if auth is missing and no API key is provided", async () => {
    auth.getAuth = async () => ({
      userId: null,
      orgId: null,
      getToken: async () => null,
    } as any);

    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req, {} as any);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, "Unauthorized");
  });

  test("2. Returns 400 Bad Request if organizationId is missing in Clerk context", async () => {
    auth.getAuth = async () => ({
      userId: "user_123",
      orgId: null,
      getToken: async () => "token_123",
    } as any);

    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req, {} as any);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error, "Organization context missing.");
  });

  test("3. Blocks request with 401 if provided API Key is invalid", async () => {
    // Provide a no-op Clerk auth so the server-only module is never reached
    auth.getAuth = async () => ({
      userId: null, orgId: null, getToken: async () => null,
    } as any);

    ConvexHttpClient.prototype.query = async (queryRef: any, args: any) => {
      // Stub api.apiKeys.validate to return null
      return null;
    };

    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer invalid_key"
      },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req, {} as any);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, "Invalid or disabled API key.");
  });

  test("4. Enforces CORS check and returns 403 Forbidden for mismatched origins", async () => {
    auth.getAuth = async () => ({
      userId: null, orgId: null, getToken: async () => null,
    } as any);

    ConvexHttpClient.prototype.query = async (queryRef: any, args: any) => {
      // Mock valid API Key with custom CORS settings
      return {
        organizationId: "org_123",
        rateLimit: 60,
        corsOrigins: ["https://trusted-site.com"],
      };
    };

    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer valid_key",
        "Origin": "https://malicious-site.com"
      },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req, {} as any);
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes("Origin \"https://malicious-site.com\" is not authorized"));
  });

  test("5. Enforces API key rate limits and returns 429 Too Many Requests", async () => {
    auth.getAuth = async () => ({
      userId: null, orgId: null, getToken: async () => null,
    } as any);

    ConvexHttpClient.prototype.query = async (queryRef: any, args: any) => {
      return {
        organizationId: "org_123",
        rateLimit: 60,
      };
    };

    ConvexHttpClient.prototype.mutation = async (mutationRef: any, args: any) => {
      // Mock recordUsageAndCheckRateLimit to return rate-limit check failure
      return { allowed: false, limit: 60 };
    };

    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer valid_key"
      },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req, {} as any);
    assert.strictEqual(res.status, 429);
    const body = await res.json();
    assert.strictEqual(body.error, "Too many requests. Limit is 60 per minute.");
  });

  test("6. Successfully runs sync agent stream on authenticated request", async () => {
    auth.getAuth = async () => ({
      userId: "user_123",
      orgId: "org_123",
      getToken: async () => "token_123",
    } as any);

    // Stub createChatAgent inside agentHelper
    agentHelper.createChatAgent = async (context: any) => {
      assert.strictEqual(context.userId, "user_123");
      assert.strictEqual(context.orgIdStr, "org_123");
      return {
        stream: async (opts: any) => ({
          toUIMessageStreamResponse: () => new Response(JSON.stringify({ success: true, answer: "AI Answer" })),
        }),
      } as any;
    };

    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [], organizationId: "org_123" }),
    });

    const res = await POST(req, {} as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.answer, "AI Answer");
  });
});
