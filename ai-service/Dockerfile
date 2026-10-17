# Build the local model into the image. Runtime is strictly offline.
FROM python:3.12-slim AS build

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    INTERVIEW_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 \
    INTERVIEW_EMBEDDING_MODEL_PATH=/models/paraphrase-multilingual-MiniLM-L12-v2

COPY requirements.txt ./
# Use PyTorch's CPU wheel index. The service has no GPU dependency and does not
# need CUDA libraries in its production image.
RUN pip install --upgrade pip \
    && pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY app ./app
COPY scripts ./scripts
# The deployment setup downloads this named BuildKit context once with
# `python ai-service/scripts/cache_interview_models.py`. It is copied into the
# image and materialized at one deterministic path. No build or runtime network
# access is used below.
COPY --from=interview_models /interview-models /model-cache
RUN set -eu; \
    model_source="$(find /model-cache/models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2/snapshots -mindepth 1 -maxdepth 1 -type d | head -n 1)"; \
    test -n "$model_source"; \
    mkdir -p /models/paraphrase-multilingual-MiniLM-L12-v2; \
    cp -a "$model_source/." /models/paraphrase-multilingual-MiniLM-L12-v2/; \
    rm -rf /model-cache; \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python -c "from app.interview_ai.resources import preload; assert preload(False)['embeddings']"

FROM python:3.12-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    INTERVIEW_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 \
    INTERVIEW_EMBEDDING_MODEL_PATH=/models/paraphrase-multilingual-MiniLM-L12-v2 \
    INTERVIEW_ANALYSIS_WORKERS=2 \
    INTERVIEW_SEMANTIC_TIMEOUT_MS=3000 \
    INTERVIEW_VAD_ENABLED=true

COPY --from=build /usr/local /usr/local
COPY --from=build /models /models
COPY --from=build /app/app ./app

RUN useradd --create-home --uid 10001 ai \
    && chown -R ai:ai /app /models
USER ai

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--limit-concurrency", "25", "--timeout-keep-alive", "5"]
