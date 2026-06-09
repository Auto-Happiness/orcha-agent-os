# Orcha Embedding Transformer

A self-hosted, zero-cost sentence-transformer microservice that provides local vector embeddings for Orcha Agent OS .

No OpenAI. No Gemini. No API billing. Ever.

---

## What it does

When a user connects a database with a large schema (>12 tables), Orcha needs to find the most relevant tables for each query instead of sending the entire schema to the LLM on every message. This service handles that by:

1. **Index time** — Embeds all table/column descriptions once when a database is connected. Vectors are stored in Convex.
2. **Query time** — Embeds the user's natural-language question, finds the most similar tables via vector search, and returns only those tables to the LLM.

This keeps LLM token usage minimal and API costs near zero for large schemas.

---

## Architecture

Built with **Domain-Driven Design (DDD)**:

```
src/orcha_embeddings/
├── domain/                         # Pure Python — no framework dependencies
│   ├── value_objects/
│   │   ├── embedding_vector.py     # Immutable float vector value object
│   │   └── embed_request.py        # EmbedRequest / EmbedBatchRequest
│   └── ports/
│       └── embedding_model_port.py # Abstract interface (port) for any embedding backend
│
├── application/                    # Use cases — orchestrates domain logic
│   ├── use_cases/
│   │   ├── embed_query_use_case.py # Single embed — called once per chat message
│   │   └── embed_batch_use_case.py # Batch embed — called once at index time
│   └── dto/
│       └── embedding_dto.py        # Pydantic request/response models (HTTP contract)
│
├── infrastructure/                 # Concrete implementations
│   ├── ml/
│   │   └── sentence_transformer_adapter.py  # Implements port using sentence-transformers
│   └── config/
│       └── settings.py             # Pydantic settings from environment variables
│
└── presentation/                   # FastAPI app, routing, DI wiring
    ├── api/v1/
    │   ├── router.py
    │   └── endpoints/
    │       ├── embeddings.py        # POST /api/embeddings, POST /api/embeddings/batch
    │       └── health.py            # GET /health
    ├── dependencies.py             # Singleton adapter via lru_cache
    └── main.py                     # FastAPI app factory + lifespan warmup
```

---

## Model

| Property | Value |
|---|---|
| **Model** | `paraphrase-multilingual-MiniLM-L12-v2` |
| **Dimensions** | 384 |
| **Languages** | 50+ (multilingual) |
| **Model size** | ~90 MB |
| **Cost** | $0 |

The model is **baked into the Docker image at build time** — zero cold-start delay when the container starts.

---

## API Reference

### `GET /api/health`

Returns service status and active model metadata.

```json
{
  "status": "ok",
  "model": "paraphrase-multilingual-MiniLM-L12-v2",
  "dimensions": 384
}
```

---

### `POST /api/embeddings`

Embeds a single text string. Called **once per user chat message** at query time.

**Request**
```json
{
  "text": "what were last month sales?",
  "model": "paraphrase-multilingual-MiniLM-L12-v2"
}
```

**Response**
```json
{
  "embedding": [0.023, -0.041, 0.112, "...383 more floats"],
  "dimensions": 384
}
```

---

### `POST /api/embeddings/batch`

Embeds multiple texts in one forward pass. Called **once at index time** when a database is connected, to embed all table/column descriptions.

**Request**
```json
{
  "texts": [
    "Table 'orders'. Description: customer purchase records. Columns: id, customer_id, total...",
    "Table 'products'. Description: product catalogue. Columns: id, name, price, sku..."
  ]
}
```

**Response**
```json
{
  "embeddings": [
    [0.023, -0.041, "..."],
    [0.011, 0.088, "..."]
  ],
  "dimensions": 384
}
```

---

## Running Locally

### With Docker Compose (recommended)

From the project root:

```bash
docker-compose up --build -d orcha-embeddings
```

The service starts on `http://localhost:5001`.

Verify it is healthy:

```bash
curl http://localhost:5001/api/health
```

Check logs:

```bash
docker logs orcha-embeddings --tail 50
```

---

### Without Docker (development)

**Requirements:** Python 3.11+

```bash
cd orcha-embedding-transformer

# Install dependencies
pip install -e ".[dev]"

# Start the server
uvicorn orcha_embeddings.presentation.main:app --port 5001 --reload
```

---

### Interactive API Docs

FastAPI auto-generates a full Swagger UI. Open in your browser after starting the service:

```
http://localhost:5001/docs
```

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `EMBEDDING_MODEL` | `paraphrase-multilingual-MiniLM-L12-v2` | HuggingFace model name |
| `EMBEDDING_DIMENSIONS` | `384` | Output vector size |
| `BATCH_SIZE` | `64` | Max texts per forward pass |
| `PORT` | `5001` | Server port |
| `LOG_LEVEL` | `info` | Uvicorn log level |

---

## Running Tests

### Unit tests (no model required)

Tests use mock adapters — `sentence-transformers` does not need to be installed.

```bash
pytest tests/unit/ -v
```

### Contract tests (no model required)

Validates the exact JSON schema contract between the consumer (Convex `embeddings.ts`) and this provider.

```bash
pytest tests/contract/test_schema_contract.py -v
```

### All tests

```bash
pytest tests/unit/ tests/contract/ -v
```

Expected output:

```
20 passed in ~1s
```

---

## Integration with Convex

Inside the Docker network, Convex actions reach this service at:

```
http://orcha-embeddings:5001/api/embeddings
```

The `local` provider in `convex/embeddings.ts` and `convex/embeddings_v2.ts` calls this endpoint automatically. No configuration is needed — the Docker service name resolves internally.

For local development outside Docker:

```
http://localhost:5001/api/embeddings
```

---

## When is the transformer called?

| Scenario | Called? |
|---|---|
| Schema with ≤ 12 tables | ❌ No — full schema fits in LLM context |
| Claude model (any schema size) | ❌ No — LLM picks tables directly |
| OpenAI / Gemini + >12 tables, **index time** | ✅ Yes — once per database connection |
| OpenAI / Gemini + >12 tables, **query time** | ✅ Yes — once per user chat message |

---

## Why a separate service?

Orcha's backend runs on Node.js (Convex). Node.js cannot call Python libraries directly — a REST API bridge is required. This approach:

- Keeps the Next.js app fully **serverless**
- Lets you run the embedding service on a separate **EC2 / Docker host**
- Allows independent scaling of the embedding service

---

## License

Part of [Orcha Agent OS](../README.md). See root `LICENSE` for details.
