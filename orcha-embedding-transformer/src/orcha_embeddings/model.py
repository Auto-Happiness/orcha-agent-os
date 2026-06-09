"""EmbeddingModel loader using sentence-transformers."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import List

from orcha_embeddings.config import settings

logger = logging.getLogger(__name__)


class EmbeddingModel:
    """Manages the SentenceTransformer model and provides helper methods for embedding."""

    def __init__(
        self,
        model_name: str | None = None,
        batch_size: int | None = None,
    ) -> None:
        from sentence_transformers import SentenceTransformer 

        self.model_name = model_name or settings.embedding_model
        self.batch_size = batch_size or settings.batch_size

        logger.info("Loading sentence-transformer model: %s", self.model_name)
        self._model = SentenceTransformer(self.model_name)

        # Warm-up probe — determines real dimension, validates the model loads.
        probe = self._model.encode(["warm-up"], convert_to_numpy=True)
        self.dimensions = int(probe.shape[1])
        logger.info(
            "Model loaded. Dimensions: %d  Batch size: %d",
            self.dimensions,
            self.batch_size,
        )

    def embed(self, text: str) -> List[float]:
        """Embed a single text string (query time)."""
        vectors = self._model.encode(
            [text],
            batch_size=1,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return vectors[0].tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of texts in one forward pass (index time)."""
        vectors = self._model.encode(
            texts,
            batch_size=self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]


@lru_cache(maxsize=1)
def get_model() -> EmbeddingModel:
    """Singleton helper to load and return the SentenceTransformer model."""
    return EmbeddingModel()
