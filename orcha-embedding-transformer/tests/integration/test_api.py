"""Integration tests — real FastAPI test client with mocked model."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from orcha_embeddings.main import create_app


@pytest.fixture()
def mock_model() -> MagicMock:
    """Mock the EmbeddingModel to avoid loading real models during API tests."""
    model = MagicMock()
    model.model_name = "paraphrase-multilingual-MiniLM-L12-v2"
    model.dimensions = 384
    model.embed.return_value = [0.42] * 384
    model.embed_batch.side_effect = lambda texts: [
        [0.42] * 384 for _ in texts
    ]
    return model


@pytest.fixture()
def client(mock_model: MagicMock) -> TestClient:
    """TestClient wrapping FastAPI app with mocked get_model dependency."""
    with patch(
        "orcha_embeddings.main.get_model",
        return_value=mock_model,
    ):
        app = create_app()
        return TestClient(app)


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["dimensions"] == 384


# ── Single embed ──────────────────────────────────────────────────────────────

def test_embed_single_returns_384_dims(client: TestClient) -> None:
    response = client.post("/api/embeddings", json={"text": "what were last month sales?"})
    assert response.status_code == 200
    body = response.json()
    assert body["dimensions"] == 384
    assert len(body["embedding"]) == 384


def test_embed_single_rejects_empty_text(client: TestClient) -> None:
    response = client.post("/api/embeddings", json={"text": ""})
    assert response.status_code == 422


# ── Batch embed ───────────────────────────────────────────────────────────────

def test_embed_batch_returns_correct_count(client: TestClient) -> None:
    response = client.post(
        "/api/embeddings/batch",
        json={"texts": ["Table orders.", "Table products.", "Table users."]},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["embeddings"]) == 3
    assert body["dimensions"] == 384


def test_embed_batch_rejects_empty_list(client: TestClient) -> None:
    response = client.post("/api/embeddings/batch", json={"texts": []})
    assert response.status_code == 422
