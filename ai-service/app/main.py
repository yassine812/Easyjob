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

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai
from app.routers import face_auth
from app.routers import career
from app.routers import recruitment

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
app.include_router(face_auth.router, prefix="/ai")
app.include_router(career.router, prefix="/ai")
app.include_router(recruitment.router, prefix="/ai")


@app.get("/health")
def health():
    from app.dependencies import get_provider
    provider = get_provider()
    return {"status": "ok", "provider": "rule_based" if provider.__class__.__name__ == "RuleBasedProvider" else "openai", "provider_connectivity_verified": False}
