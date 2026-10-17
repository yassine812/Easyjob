"""Startup Starter AI service.

A separate FastAPI service that owns all AI-related processing. The NestJS
backend is the only client; the frontend never talks to this service directly.

Pipeline: NestJS -> BullMQ -> FastAPI -> AI provider/model -> result.

The provider is pluggable (see app/providers). When no API key is configured,
a deterministic rule-based provider is used (suitable for development and
automated tests). Set OPENAI_API_KEY to use an OpenAI-compatible chat model.
"""
import logging
import os
from pathlib import Path
from threading import Thread, Timer

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai
from app.routers import face_auth
from app.routers import career
from app.routers import recruitment
from app.routers import job_drafting, meeting_transcription

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="Startup Starter AI service",
    # NOTE: the API-key dependency is applied on the /ai router (see routers/ai.py)
    # so that /health stays open for container health checks.
    version="1.0.0",
    description="AI processing for Startup Starter (CV analysis, generation, matching, etc.)",
)

app.add_middleware(
    CORSMiddleware,
    # The AI service is backend-to-backend; browsers never call it, so deny
    # cross-origin browser access by default (allow only explicit origins).
    allow_origins=os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else [],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router, prefix="/ai")
app.include_router(meeting_transcription.router, prefix="/ai")
app.include_router(face_auth.router, prefix="/ai")
app.include_router(career.router, prefix="/ai")
app.include_router(recruitment.router, prefix="/ai")
app.include_router(job_drafting.router, prefix="/drafting")


@app.on_event("startup")
def preload_interview_intelligence() -> None:
    # Keep liveness responsive while loading; readiness gates traffic until the
    # preloaded resources are usable. Downloads are never allowed at runtime.
    from app.interview_ai.resources import preload
    def load() -> None:
        state = preload(allow_download=False)
        if state["embeddings"]:
            logger.info("Local multilingual interview embeddings are ready in %sms", state["startup_ms"])
        else:
            logger.error("Interview service started in deterministic fallback mode")
    # Yield once to Uvicorn first: `/health/live` must be observable before
    # importing Torch/Transformers starts its CPU-heavy initialization.
    Timer(.25, lambda: Thread(target=load, name="interview-resource-preload", daemon=True).start()).start()


@app.get("/health/face")
def face_readiness():
    from app.face.readiness import verify_models
    try:
        verify_models()
    except Exception:
        logger.exception('Face model readiness failed')
        raise HTTPException(status_code=503, detail='Face models unavailable') from None
    return {"status": "ok"}


@app.get("/health")
def health():
    from app.dependencies import get_provider
    provider = get_provider()
    return {"status": "ok", "provider": "rule_based" if provider.__class__.__name__ == "RuleBasedProvider" else "openai", "provider_connectivity_verified": False}


@app.get("/health/live")
def liveness():
    return {"status": "live"}


@app.get("/health/ready")
def interview_readiness():
    from app.interview_ai.resources import readiness
    state = readiness()
    whisper_configured = bool(os.getenv('FASTER_WHISPER_MODEL_PATH')) and Path(os.getenv('FASTER_WHISPER_MODEL_PATH', '')).exists()
    vad_enabled = os.getenv('INTERVIEW_VAD_ENABLED', 'true').lower() in ('true', '1')
    public = {"tfidf": state["tfidf"], "embeddings": state["embeddings"], "stt": whisper_configured, "vad": vad_enabled,
              "model_instance_count": state["model_instance_count"],
              "analysis_engine": "local_hybrid" if state["embeddings"] else "local_deterministic_fallback"}
    if state["loading"]:
        return JSONResponse(status_code=503, content={"status": "loading", **public})
    if not state["initialized"] or not state["tfidf"] or not state["embeddings"]:
        return JSONResponse(status_code=503, content={"status": "degraded", **public})
    return {"status": "ready", **public}


@app.get("/health/metrics")
def interview_metrics():
    from app.interview_ai.runtime import metrics
    from app.interview_ai.resources import readiness
    state = readiness()
    return {"model_ready": bool(state["embeddings"]), "model_instance_count": state["model_instance_count"], **metrics()}
