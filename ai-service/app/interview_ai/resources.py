"""Lifecycle management for local interview-analysis resources."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from threading import RLock
from typing import Any

logger = logging.getLogger("ai-service.interview-resources")

MODEL_NAME = os.getenv(
    "INTERVIEW_EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
DEFAULT_CACHE = Path(__file__).resolve().parents[3] / ".runtime" / "interview-models"
MODEL_CACHE = Path(os.getenv("INTERVIEW_MODEL_CACHE", str(DEFAULT_CACHE))).resolve()
MODEL_PATH = Path(os.getenv("INTERVIEW_EMBEDDING_MODEL_PATH", "")).resolve() if os.getenv("INTERVIEW_EMBEDDING_MODEL_PATH") else None

_lock = RLock()
_embedding_model: Any | None = None
_model_instance_count = 0
_state: dict[str, Any] = {
    "initialized": False,
    "loading": False,
    "tfidf": False,
    "embeddings": False,
    "stt": False,
    "vad": False,
    "model": MODEL_NAME,
    "startup_ms": None,
    "embedding_error": None,
}


def preload(allow_download: bool = False) -> dict[str, Any]:
    """Load reusable CPU resources before the first candidate answer arrives."""
    global _embedding_model, _model_instance_count
    with _lock:
        if _state["initialized"] or _state["loading"]:
            return readiness()
        _state["loading"] = True
        started = time.perf_counter()
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: F401
            from sklearn.metrics.pairwise import cosine_similarity  # noqa: F401
            _state["tfidf"] = True
        except Exception as exc:
            logger.exception("TF-IDF resources unavailable")
            _state["embedding_error"] = f"tfidf unavailable: {exc!s}"
        try:
            from sentence_transformers import SentenceTransformer
            if MODEL_PATH is not None:
                if not MODEL_PATH.is_dir():
                    raise FileNotFoundError("Configured local embedding model is missing")
                model_source = str(MODEL_PATH)
                cache_folder = None
            else:
                MODEL_CACHE.mkdir(parents=True, exist_ok=True)
                model_source = MODEL_NAME
                cache_folder = str(MODEL_CACHE)
            if not allow_download:
                # Enforce the runtime contract even when a host has network
                # access: inference may use only the deployment cache.
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            _embedding_model = SentenceTransformer(
                model_source,
                cache_folder=cache_folder,
                device="cpu",
                local_files_only=not allow_download,
            )
            _model_instance_count += 1
            _state["embeddings"] = True
        except Exception as exc:
            _embedding_model = None
            _state["embedding_error"] = str(exc)
            logger.warning("Semantic model unavailable; using TF-IDF and deterministic rules: %s", exc)
        _state["startup_ms"] = round((time.perf_counter() - started) * 1000, 1)
        _state["initialized"] = True
        _state["loading"] = False
        return readiness()


def embedding_model() -> Any | None:
    return _embedding_model


def readiness() -> dict[str, Any]:
    with _lock:
        return {**_state, "model_instance_count": _model_instance_count}
