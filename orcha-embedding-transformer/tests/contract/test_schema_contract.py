"""Schema contract tests — pure pytest, no Pact broker required.

These tests assert that every API response strictly matches the agreed
JSON schema between the consumer (Convex embeddings.ts) and provider
(FastAPI service).

Uses FastAPI dependency_overrides so sentence_transformers does NOT
need to be installed to run these tests.

Run:
    pytest tests/contract/test_schema_contract.py -v
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from orcha_embeddings.model import get_model
from orcha_embeddings.main import create_app


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def mock_model() -> MagicMock:
    model = MagicMock()
    model.model_name = "paraphrase-multilingual-MiniLM-L12-v2"
    model.dimensions = 384
    model.embed.return_value = [round(i * 0.001, 4) for i in range(384)]
    model.embed_batch.side_effect = lambda texts: [
        [round(i * 0.001, 4) for i in range(384)]
        for _ in texts
    ]
    return model


@pytest.fixture(scope="module")
def client(mock_model: MagicMock) -> TestClient:
    """TestClient with dependency overrides — no real model needed."""
    app = create_app()

    # Override FastAPI dependencies so the real EmbeddingModel
    # is never instantiated during contract tests.
    app.dependency_overrides[get_model] = lambda: mock_model

    return TestClient(app, raise_server_exceptions=False)


# ── Schema validators ─────────────────────────────────────────────────────────


def assert_health_contract(body: dict[str, Any]) -> None:
    """Contract: GET /api/health response schema."""
    assert "status" in body,      "Contract violation: 'status' field missing"
    assert "model" in body,       "Contract violation: 'model' field missing"
    assert "dimensions" in body,  "Contract violation: 'dimensions' field missing"
    assert isinstance(body["status"], str),     "Contract violation: 'status' must be string"
    assert isinstance(body["model"], str),       "Contract violation: 'model' must be string"
    assert isinstance(body["dimensions"], int),  "Contract violation: 'dimensions' must be int"
    assert body["status"] == "ok",               "Contract violation: 'status' must be 'ok'"
    assert body["dimensions"] > 0,               "Contract violation: 'dimensions' must be > 0"


def assert_single_embed_contract(body: dict[str, Any], expected_dims: int = 384) -> None:
    """Contract: POST /api/embeddings response schema."""
    assert "embedding" in body,   "Contract violation: 'embedding' field missing"
    assert "dimensions" in body,  "Contract violation: 'dimensions' field missing"
    assert isinstance(body["embedding"], list),  "Contract violation: 'embedding' must be array"
    assert isinstance(body["dimensions"], int),  "Contract violation: 'dimensions' must be int"
    assert len(body["embedding"]) == body["dimensions"], \
        "Contract violation: embedding length must equal dimensions"
    assert body["dimensions"] == expected_dims, \
        f"Contract violation: dimensions must be {expected_dims}, got {body['dimensions']}"
    assert all(isinstance(v, (int, float)) for v in body["embedding"]), \
        "Contract violation: all embedding values must be numeric"


def assert_batch_embed_contract(
    body: dict[str, Any], expected_count: int, expected_dims: int = 384
) -> None:
    """Contract: POST /api/embeddings/batch response schema."""
    assert "embeddings" in body,  "Contract violation: 'embeddings' field missing"
    assert "dimensions" in body,  "Contract violation: 'dimensions' field missing"
    assert isinstance(body["embeddings"], list),  "Contract violation: 'embeddings' must be array"
    assert isinstance(body["dimensions"], int),   "Contract violation: 'dimensions' must be int"
    assert len(body["embeddings"]) == expected_count, \
        f"Contract violation: expected {expected_count} embeddings, got {len(body['embeddings'])}"
    assert body["dimensions"] == expected_dims, \
        f"Contract violation: dimensions must be {expected_dims}, got {body['dimensions']}"
    for i, vec in enumerate(body["embeddings"]):
        assert isinstance(vec, list), \
            f"Contract violation: embeddings[{i}] must be an array"
        assert len(vec) == expected_dims, \
            f"Contract violation: embeddings[{i}] must have {expected_dims} values"
        assert all(isinstance(v, (int, float)) for v in vec), \
            f"Contract violation: embeddings[{i}] values must be numeric"


# ── Contract tests ────────────────────────────────────────────────────────────


class TestHealthContract:
    """Contract: GET /api/health"""

    def test_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/health")
        assert response.status_code == 200, \
            f"Contract violation: /api/health must return 200, got {response.status_code}"

    def test_response_schema(self, client: TestClient) -> None:
        body = client.get("/api/health").json()
        assert_health_contract(body)

    def test_content_type_is_json(self, client: TestClient) -> None:
        response = client.get("/api/health")
        assert "application/json" in response.headers["content-type"], \
            "Contract violation: Content-Type must be application/json"


class TestSingleEmbedContract:
    """Contract: POST /api/embeddings"""

    def test_valid_request_returns_200(self, client: TestClient) -> None:
        response = client.post("/api/embeddings", json={"text": "what were last month sales?"})
        assert response.status_code == 200, \
            f"Contract violation: must return 200 for valid request, got {response.status_code}"

    def test_response_schema(self, client: TestClient) -> None:
        body = client.post("/api/embeddings", json={"text": "test query"}).json()
        assert_single_embed_contract(body, expected_dims=384)

    def test_empty_text_returns_422(self, client: TestClient) -> None:
        response = client.post("/api/embeddings", json={"text": ""})
        assert response.status_code == 422, \
            f"Contract violation: empty text must return 422, got {response.status_code}"

    def test_missing_text_field_returns_422(self, client: TestClient) -> None:
        response = client.post("/api/embeddings", json={"model": "some-model"})
        assert response.status_code == 422, \
            "Contract violation: missing 'text' field must return 422"

    def test_content_type_is_json(self, client: TestClient) -> None:
        response = client.post("/api/embeddings", json={"text": "hello"})
        assert "application/json" in response.headers["content-type"], \
            "Contract violation: Content-Type must be application/json"

    def test_custom_model_field_is_accepted(self, client: TestClient) -> None:
        response = client.post("/api/embeddings", json={
            "text": "test",
            "model": "paraphrase-multilingual-MiniLM-L12-v2",
        })
        assert response.status_code == 200, \
            "Contract violation: explicit model field must be accepted"


class TestBatchEmbedContract:
    """Contract: POST /api/embeddings/batch"""

    def test_valid_request_returns_200(self, client: TestClient) -> None:
        response = client.post("/api/embeddings/batch", json={
            "texts": ["Table orders.", "Table products.", "Table users."]
        })
        assert response.status_code == 200, \
            f"Contract violation: must return 200 for valid batch, got {response.status_code}"

    def test_response_schema_single_item(self, client: TestClient) -> None:
        body = client.post("/api/embeddings/batch", json={"texts": ["only one"]}).json()
        assert_batch_embed_contract(body, expected_count=1, expected_dims=384)

    def test_response_schema_multiple_items(self, client: TestClient) -> None:
        texts = [f"Table {i}." for i in range(5)]
        body = client.post("/api/embeddings/batch", json={"texts": texts}).json()
        assert_batch_embed_contract(body, expected_count=5, expected_dims=384)

    def test_embedding_count_matches_input_count(self, client: TestClient) -> None:
        texts = ["alpha", "beta", "gamma", "delta"]
        body = client.post("/api/embeddings/batch", json={"texts": texts}).json()
        assert len(body["embeddings"]) == len(texts), \
            "Contract violation: output count must equal input count"

    def test_empty_texts_returns_422(self, client: TestClient) -> None:
        response = client.post("/api/embeddings/batch", json={"texts": []})
        assert response.status_code == 422, \
            f"Contract violation: empty texts array must return 422, got {response.status_code}"

    def test_missing_texts_field_returns_422(self, client: TestClient) -> None:
        response = client.post("/api/embeddings/batch", json={})
        assert response.status_code == 422, \
            "Contract violation: missing 'texts' field must return 422"

    def test_content_type_is_json(self, client: TestClient) -> None:
        response = client.post("/api/embeddings/batch", json={"texts": ["hello"]})
        assert "application/json" in response.headers["content-type"], \
            "Contract violation: Content-Type must be application/json"
