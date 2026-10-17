# Local interview AI production deployment

During deployment setup, cache the model once on the build host, then build the
persistent local analysis service. The build copies that cache into the image;
it does not download the model itself:

```sh
python ai-service/scripts/cache_interview_models.py
docker build --build-context interview_models=.runtime -f ai-service/Dockerfile -t easyjob-ai:production ai-service
```

The build downloads `paraphrase-multilingual-MiniLM-L12-v2` once, then stores it at `/models/paraphrase-multilingual-MiniLM-L12-v2`. Runtime uses `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, and `INTERVIEW_EMBEDDING_MODEL_PATH` to load that path only. No Hugging Face, Ollama, hosted inference, or paid API is needed after the image build.

Run the production topology through `docker-compose.prod.yml`. The AI service publishes no port and is reachable only as `http://ai:8000` from the backend/worker Docker network. Keep the service as one persistent Uvicorn worker: this shares one model instance and prevents replica workers from multiplying model memory.

Health endpoints are internal:

- `GET /health/live` reports process liveness immediately.
- `GET /health/ready` is `503` with `status: loading` until TF-IDF and embeddings are preloaded, then returns `status: ready` and `analysis_engine: local_hybrid`.
- `GET /health/metrics` exposes aggregate request volume, latency, fallback count, errors, follow-up rate and readiness. It never includes answers, CV data, stack traces, or filesystem paths.

The production compose profile caps the AI container at 2 CPUs and 2 GiB RAM. This is the recommended starting allocation for one local model worker. GPU is not required. Scale by adding separately provisioned AI containers only after load testing; do not raise Uvicorn worker count in one container because every worker loads another model instance.

Semantic analysis is bounded by `INTERVIEW_ANALYSIS_WORKERS` and `INTERVIEW_SEMANTIC_TIMEOUT_MS`. A timeout or model error returns deterministic TF-IDF/rule scoring with `analysis_engine: local_deterministic_fallback`, so the candidate answer and session progression remain intact. The backend derives a SHA-256 idempotency key from session, question index, and answer; retrying a request returns the same cached AI result without creating another decision.
