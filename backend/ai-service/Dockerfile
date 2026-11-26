# Build the local model into the image. Runtime is strictly offline.
FROM python:3.12-slim AS build

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    INTERVIEW_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 \
    INTERVIEW_EMBEDDING_MODEL_PATH=/models/paraphrase-multilingual-MiniLM-L12-v2 \
    FASTER_WHISPER_MODEL_PATH=/models/faster-whisper-small

COPY requirements.txt ./
# Use PyTorch's CPU wheel index. The service has no GPU dependency and does not
# need CUDA libraries in its production image.
RUN pip install --upgrade pip \
    && pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

ENV PYTHONPATH=/app

COPY app ./app
COPY scripts ./scripts
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libxcb1 \
    && rm -rf /var/lib/apt/lists/*
# Download and materialize the pinned multilingual model during the image
# build. This keeps a clean VPS clone deployable: no ignored `.runtime` folder
# or host-side Python setup is required, and the runtime remains offline.
RUN python scripts/cache_face_models.py \
    && python scripts/cache_speech_models.py \
    && python scripts/cache_interview_models.py \
    && HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python -c "from app.face.readiness import verify_models; verify_models(); from app.job_drafting.knowledge import knowledge_base; assert knowledge_base().roles; from app.interview_ai.resources import preload; state = preload(False); assert state['embeddings'] and state['stt'], 'Offline interview models did not load'"

FROM python:3.12-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    INTERVIEW_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 \
    INTERVIEW_EMBEDDING_MODEL_PATH=/models/paraphrase-multilingual-MiniLM-L12-v2 \
    FASTER_WHISPER_MODEL_PATH=/models/faster-whisper-small \
    INTERVIEW_ANALYSIS_WORKERS=2 \
    INTERVIEW_SEMANTIC_TIMEOUT_MS=3000 \
    INTERVIEW_VAD_ENABLED=true

# MediaPipe may install the OpenCV contrib wheel alongside the headless wheel.
# Its native loader still requires these shared libraries on Debian slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libxcb1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/local /usr/local
COPY --from=build /models /models
COPY --from=build /app/app ./app

RUN useradd --create-home --uid 10001 ai \
    && chown -R ai:ai /app /models
USER ai

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--limit-concurrency", "25", "--timeout-keep-alive", "5"]
