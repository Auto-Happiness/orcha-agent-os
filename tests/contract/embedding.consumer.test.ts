/**
 * Contract Test — Consumer Side
 *
 * Defines what Convex (the consumer) expects from the
 * orcha-embedding-transformer service (the provider).
 *
 * Running this test:
 *   npx jest tests/contract/embedding.consumer.test.ts
 *
 * Output: pacts/orcha-convex-orcha-embedding-transformer.json
 * That file is then used by the Python provider verification tests.
 */

import path from "path";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const { like, eachLike, integer, decimal } = MatchersV3;

const provider = new PactV3({
  consumer: "orcha-convex",
  provider: "orcha-embedding-transformer",
  dir: path.resolve(__dirname, "../../pacts"),
  logLevel: "warn",
});

// ── Shared request headers ─────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── 1. Health endpoint ─────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns service status and model metadata", () => {
    provider
      .given("the embedding service is running")
      .uponReceiving("a health check request")
      .withRequest({ method: "GET", path: "/api/health" })
      .willRespondWith({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          status: like("ok"),
          model: like("paraphrase-multilingual-MiniLM-L12-v2"),
          dimensions: integer(384),
        },
      });

    return provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/health`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(typeof body.dimensions).toBe("number");
    });
  });
});

// ── 2. Single embed endpoint (query time) ─────────────────────────────────

describe("POST /api/embeddings", () => {
  it("returns a 384-dimensional embedding for a query string", () => {
    provider
      .given("the model is loaded and ready")
      .uponReceiving("a single embed request with a natural-language query")
      .withRequest({
        method: "POST",
        path: "/api/embeddings",
        headers: JSON_HEADERS,
        body: {
          text: like("what were last month sales?"),
        },
      })
      .willRespondWith({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          embedding: eachLike(decimal(0.042), 1),
          dimensions: integer(384),
        },
      });

    return provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/embeddings`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ text: "what were last month sales?" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body.embedding)).toBe(true);
      expect(body.dimensions).toBeGreaterThan(0);
    });
  });

  it("rejects an empty text with HTTP 422", () => {
    provider
      .given("the model is loaded and ready")
      .uponReceiving("a single embed request with empty text")
      .withRequest({
        method: "POST",
        path: "/api/embeddings",
        headers: JSON_HEADERS,
        body: { text: "" },
      })
      .willRespondWith({ status: 422 });

    return provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/embeddings`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ text: "" }),
      });
      expect(res.status).toBe(422);
    });
  });
});

// ── 3. Batch embed endpoint (index time) ──────────────────────────────────

describe("POST /api/embeddings/batch", () => {
  it("returns one embedding vector per input text", () => {
    provider
      .given("the model is loaded and ready")
      .uponReceiving("a batch embed request with multiple table descriptions")
      .withRequest({
        method: "POST",
        path: "/api/embeddings/batch",
        headers: JSON_HEADERS,
        body: {
          texts: [
            like("Table 'orders'. Description: customer purchase records."),
            like("Table 'products'. Description: product catalogue."),
          ],
        },
      })
      .willRespondWith({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          embeddings: eachLike(eachLike(decimal(0.042), 1), 2),
          dimensions: integer(384),
        },
      });

    return provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/embeddings/batch`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          texts: [
            "Table 'orders'. Description: customer purchase records.",
            "Table 'products'. Description: product catalogue.",
          ],
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body.embeddings)).toBe(true);
      expect(body.embeddings).toHaveLength(2);
      expect(body.dimensions).toBeGreaterThan(0);
    });
  });

  it("rejects an empty texts array with HTTP 422", () => {
    provider
      .given("the model is loaded and ready")
      .uponReceiving("a batch embed request with no texts")
      .withRequest({
        method: "POST",
        path: "/api/embeddings/batch",
        headers: JSON_HEADERS,
        body: { texts: [] },
      })
      .willRespondWith({ status: 422 });

    return provider.executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/embeddings/batch`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ texts: [] }),
      });
      expect(res.status).toBe(422);
    });
  });
});
