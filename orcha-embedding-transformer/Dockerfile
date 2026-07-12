# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools
RUN pip install --no-cache-dir setuptools wheel

# Copy project definition and install into a prefix we can COPY later
COPY pyproject.toml .
COPY src/ src/

RUN pip install --no-cache-dir --prefix=/install .

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

LABEL org.opencontainers.image.title="Orcha Embedding Transformer" \
      org.opencontainers.image.description="Local sentence-transformer service — paraphrase-multilingual-MiniLM-L12-v2" \
      org.opencontainers.image.version="1.0.0"

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy source
COPY src/ src/

# Pre-download the model at build time — zero cold-start delay at runtime.
# The model (~90 MB) is baked into the image layer and cached in HuggingFace's
# default cache directory (/root/.cache/huggingface).
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
print('Downloading model...'); \
SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2'); \
print('Model ready.')"

# Set runtime offline flags so the container runs fully local without Hugging Face network requests
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

EXPOSE 5001

# Health check — waits for the service to be ready before marking healthy
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/api/health')"

CMD ["uvicorn", "orcha_embeddings.main:app", \
     "--host", "0.0.0.0", \
     "--port", "5001", \
     "--log-level", "info"]
