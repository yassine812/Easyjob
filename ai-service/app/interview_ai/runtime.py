"""Bounded, observable execution for local interview analysis."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .answer_analyzer import analyze

logger = logging.getLogger("ai-service.interview-runtime")
MAX_WORKERS = max(1, int(os.getenv("INTERVIEW_ANALYSIS_WORKERS", "2")))
TIMEOUT_SECONDS = max(0.1, int(os.getenv("INTERVIEW_SEMANTIC_TIMEOUT_MS", "3000")) / 1000)
_executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="interview-analysis")
_semaphore = asyncio.Semaphore(MAX_WORKERS)
_metrics_lock = threading.Lock()
_metrics: dict[str, int | float] = {"requests": 0, "fallbacks": 0, "errors": 0, "follow_ups": 0, "latency_ms_total": 0.0}
_idempotency: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
_IDEMPOTENCY_TTL_SECONDS = 15 * 60
_IDEMPOTENCY_MAX = 1000


def _record(result: dict[str, Any], elapsed_ms: float, fallback: bool = False, error: bool = False) -> None:
    with _metrics_lock:
        _metrics["requests"] += 1
        _metrics["latency_ms_total"] += elapsed_ms
        _metrics["follow_ups"] += int(bool(result.get("follow_up_needed")))
        _metrics["fallbacks"] += int(fallback)
        _metrics["errors"] += int(error)
    logger.info(json.dumps({"event": "interview_analysis", "latency_ms": round(elapsed_ms, 1), "analysis_engine": result.get("analysis_engine"), "fallback": fallback, "follow_up": bool(result.get("follow_up_needed")), "error": error}))


async def analyze_safely(answer: str, question: str, rubric: dict[str, Any], speaking_seconds: int | None = None, pauses: int | None = None) -> dict[str, Any]:
    """Bound CPU work and return deterministic scoring if semantic work fails."""
    started = time.perf_counter()
    fallback = False
    error = False
    try:
        async with _semaphore:
            loop = asyncio.get_running_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(_executor, analyze, answer, question, rubric, speaking_seconds, pauses),
                timeout=TIMEOUT_SECONDS,
            )
    except (asyncio.TimeoutError, Exception) as exc:
        fallback = True
        error = not isinstance(exc, asyncio.TimeoutError)
        logger.warning(json.dumps({"event": "semantic_analysis_fallback", "reason": "timeout" if isinstance(exc, asyncio.TimeoutError) else type(exc).__name__}))
        result = analyze(answer, question, rubric, speaking_seconds, pauses, use_embeddings=False)
    fallback = fallback or result.get("analysis_engine") == "local_deterministic_fallback"
    elapsed_ms = (time.perf_counter() - started) * 1000
    _record(result, elapsed_ms, fallback=fallback, error=error)
    return result


def get_cached(idempotency_key: str | None) -> dict[str, Any] | None:
    if not idempotency_key:
        return None
    now = time.monotonic()
    with _metrics_lock:
        item = _idempotency.get(idempotency_key)
        if not item or now - item[0] > _IDEMPOTENCY_TTL_SECONDS:
            _idempotency.pop(idempotency_key, None)
            return None
        _idempotency.move_to_end(idempotency_key)
        return item[1]


def cache_result(idempotency_key: str | None, response: dict[str, Any]) -> None:
    if not idempotency_key:
        return
    with _metrics_lock:
        _idempotency[idempotency_key] = (time.monotonic(), response)
        _idempotency.move_to_end(idempotency_key)
        while len(_idempotency) > _IDEMPOTENCY_MAX:
            _idempotency.popitem(last=False)


def metrics() -> dict[str, Any]:
    with _metrics_lock:
        requests = int(_metrics["requests"])
        return {"request_volume": requests, "fallback_count": int(_metrics["fallbacks"]), "error_count": int(_metrics["errors"]),
                "follow_up_rate": round(int(_metrics["follow_ups"]) / requests, 4) if requests else 0.0,
                "average_latency_ms": round(float(_metrics["latency_ms_total"]) / requests, 2) if requests else 0.0,
                "max_concurrent_analyses": MAX_WORKERS, "semantic_timeout_ms": int(TIMEOUT_SECONDS * 1000)}
