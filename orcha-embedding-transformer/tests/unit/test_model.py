"""Unit tests for the simplified EmbeddingModel class."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from orcha_embeddings.model import EmbeddingModel


@pytest.fixture()
def mock_transformer():
    """Patch the sentence-transformers package to avoid loading real models during unit tests."""
    with patch("sentence_transformers.SentenceTransformer") as mock_class:
        mock_instance = MagicMock()
        mock_class.return_value = mock_instance
        # Mock probe encode return value (needs 2D numpy array with 384 dimensions)
        mock_instance.encode.return_value = np.zeros((1, 384))
        yield mock_instance


def test_model_initialization(mock_transformer) -> None:
    """Verify that EmbeddingModel initializes, runs warm-up, and captures dimensions."""
    model = EmbeddingModel()
    assert model.model_name == "paraphrase-multilingual-MiniLM-L12-v2"
    assert model.dimensions == 384
    mock_transformer.encode.assert_called_once_with(["warm-up"], convert_to_numpy=True)


def test_embed_single(mock_transformer) -> None:
    """Verify single query embedding execution and parameters."""
    model = EmbeddingModel()
    mock_transformer.encode.reset_mock()

    mock_transformer.encode.return_value = np.array([[0.1] * 384])
    
    result = model.embed("what were last month sales?")
    assert len(result) == 384
    assert result[0] == 0.1
    
    mock_transformer.encode.assert_called_once_with(
        ["what were last month sales?"],
        batch_size=1,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )


def test_embed_batch(mock_transformer) -> None:
    """Verify batch embedding execution and parameters."""
    model = EmbeddingModel()
    mock_transformer.encode.reset_mock()

    mock_transformer.encode.return_value = np.array([[0.2] * 384, [0.3] * 384])
    
    results = model.embed_batch(["Table A.", "Table B."])
    assert len(results) == 2
    assert results[0][0] == 0.2
    assert results[1][0] == 0.3
    
    mock_transformer.encode.assert_called_once_with(
        ["Table A.", "Table B."],
        batch_size=model.batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
