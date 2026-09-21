"""AI endpoints. Requested by the NestJS backend only (never by the frontend)."""
import inspect
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import require_api_key
from app.dependencies import get_provider
from app.providers.base import AIProvider

logger = logging.getLogger("ai-service.routes")
# Every /ai endpoint is protected by the shared API key when AI_API_KEY is set
# (the NestJS backend presents it; browsers and /health stay open).
router = APIRouter(dependencies=[Depends(require_api_key)])


async def _run(provider: AIProvider, method: str, *args: Any) -> Any:
    """Calls a provider method, awaiting it if it is a coroutine."""
    fn = getattr(provider, method)
    result = fn(*args)
    if inspect.isawaitable(result):
        return await result
    return result


@router.post("/cv/extract")
async def cv_extract(file: UploadFile = File(...)) -> dict[str, str]:
    """Extracts plain text from an uploaded CV (PDF/docx/txt)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    try:
        from app.text_extraction import extract_text

        data = await file.read()
        text = await extract_text(file.filename, data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Extraction failed for %s: %s", file.filename, exc)
        raise HTTPException(status_code=422, detail=f"Could not extract text: {exc}") from exc
    return {"text": text}


@router.post("/cv/analyze")
async def cv_analyze(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    text = payload.get("text") or payload.get("cv_text")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text'")
    try:
        return await _run(provider, "analyze_cv", str(text), payload.get("filename"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc


@router.post("/cv/generate")
async def cv_generate(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    profile = payload.get("profile") or {}
    if not profile:
        raise HTTPException(status_code=400, detail="Missing 'profile'")
    try:
        return await _run(provider, "generate_cv", profile)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc


@router.post("/cv/tailor")
async def cv_tailor(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    cv_text = payload.get("cv_text")
    job = payload.get("job") or {}
    if not cv_text or not job:
        raise HTTPException(status_code=400, detail="Missing 'cv_text' or 'job'")
    try:
        return await _run(provider, "tailor_cv", str(cv_text), job)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc


@router.post("/job/analyze")
async def job_analyze(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    job = payload.get("job") or {}
    if not job:
        raise HTTPException(status_code=400, detail="Missing 'job'")
    try:
        return await _run(provider, "analyze_job", job)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc


@router.post("/match")
async def match(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    candidate = payload.get("candidate") or {}
    job = payload.get("job") or {}
    if not candidate or not job:
        raise HTTPException(status_code=400, detail="Missing 'candidate' or 'job'")
    try:
        return await _run(provider, "match", candidate, job)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc


@router.post("/cover-letter")
async def cover_letter(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    candidate = payload.get("candidate") or {}
    job = payload.get("job") or {}
    if not candidate or not job:
        raise HTTPException(status_code=400, detail="Missing 'candidate' or 'job'")
    try:
        return await _run(provider, "cover_letter", candidate, job)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc


@router.post("/interview")
async def interview(payload: dict[str, Any], provider: AIProvider = Depends(get_provider)) -> dict[str, Any]:
    job = payload.get("job") or {}
    candidate = payload.get("candidate") or {}
    if not job or not candidate:
        raise HTTPException(status_code=400, detail="Missing 'job' or 'candidate'")
    try:
        return await _run(provider, "interview", job, candidate)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc
