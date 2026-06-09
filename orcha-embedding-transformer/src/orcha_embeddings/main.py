"""FastAPI application for the local embedding transformer service."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, List

from fastapi import FastAPI, Depends, HTTPException, APIRouter
from pydantic import BaseModel, Field

from orcha_embeddings.config import settings
from orcha_embeddings.model import get_model, EmbeddingModel

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    model: str
    dimensions: int


class EmbedRequest(BaseModel):
    """Request body for POST /api/embeddings (single text, query time)."""

    text: str = Field(..., min_length=1, description="The text to embed.")
    model: str = Field(
        default="paraphrase-multilingual-MiniLM-L12-v2",
        description="Sentence-transformer model name.",
    )

    model_config = {"json_schema_extra": {"example": {"text": "what were last month sales?"}}}


class EmbedBatchRequest(BaseModel):
    """Request body for POST /api/embeddings/batch (bulk, index time)."""

    texts: List[str] = Field(..., min_length=1, description="List of texts to embed.")
    model: str = Field(
        default="paraphrase-multilingual-MiniLM-L12-v2",
        description="Sentence-transformer model name.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "texts": [
                    "Table 'orders'. Description: customer purchase records.",
                    "Table 'products'. Description: product catalogue.",
                ]
            }
        }
    }


class EmbedResponse(BaseModel):
    embedding: List[float] = Field(..., description="Dense float vector.")
    dimensions: int = Field(..., description="Length of the embedding vector.")


class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="One vector per input text.")
    dimensions: int = Field(..., description="Length of each embedding vector.")


# ── Router & Endpoints ─────────────────────────────────────────────────────────

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(model: EmbeddingModel = Depends(get_model)) -> HealthResponse:
    """Return service health and active model metadata.

    Used by Docker health checks and infrastructure monitoring.
    """
    return HealthResponse(
        status="ok",
        model=model.model_name,
        dimensions=model.dimensions,
    )


@router.post(
    "/embeddings",
    response_model=EmbedResponse,
    summary="Embed a single text (query time)",
    tags=["Embeddings"],
)
async def embed_single(
    body: EmbedRequest,
    model: EmbeddingModel = Depends(get_model),
) -> EmbedResponse:
    """Embed one piece of text.

    Called once per user chat message to vectorise the natural-language
    question before performing similarity search against indexed tables.
    """
    try:
        # Extra validation for whitespace-only strings
        if not body.text or not body.text.strip():
            raise ValueError("text must not be empty or whitespace-only.")

        vector = model.embed(body.text)
        return EmbedResponse(embedding=vector, dimensions=len(vector))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during single embed")
        raise HTTPException(status_code=500, detail="Embedding failed.") from exc


@router.post(
    "/embeddings/batch",
    response_model=EmbedBatchResponse,
    summary="Embed multiple texts (index time)",
    tags=["Embeddings"],
)
async def embed_batch(
    body: EmbedBatchRequest,
    model: EmbeddingModel = Depends(get_model),
) -> EmbedBatchResponse:
    """Embed a batch of texts in one forward pass.

    Called once when a database is connected to index all table/column
    descriptions.  Results are stored and reused for all future queries.
    """
    try:
        if not body.texts:
            raise ValueError("texts must not be empty.")

        vectors = model.embed_batch(body.texts)
        dimensions = len(vectors[0]) if vectors else 0
        return EmbedBatchResponse(
            embeddings=vectors,
            dimensions=dimensions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during batch embed")
        raise HTTPException(status_code=500, detail="Batch embedding failed.") from exc


# ── Lifespan & App Factory ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting Orcha Embedding Transformer…")
    get_model()  # Triggers lru_cache -> model loads here
    logger.info("Model warm. Service is ready.")
    yield
    logger.info("Orcha Embedding Transformer shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Orcha Embedding Transformer",
        description=(
            "Local sentence-transformer microservice. "
            "Provides zero-cost vector embeddings using "
            "paraphrase-multilingual-MiniLM-L12-v2."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    app.include_router(router, prefix="/api")

    return app


app = create_app()
