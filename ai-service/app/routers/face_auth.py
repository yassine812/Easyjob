"""Face authentication endpoints.

Called ONLY by the NestJS backend (Bearer AI_API_KEY, same as the rest of
/ai). The browser never talks to this service: frames go browser → NestJS →
FastAPI → embedding → NestJS, where the authentication decision is made.

No face data is stored here: frames are decoded in memory, processed and
discarded. The embedding is returned to NestJS which encrypts it at rest.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.auth import require_api_key
from app.face import detector, embedding, liveness, quality

logger = logging.getLogger("ai-service.face")

router = APIRouter(
    prefix="/face",
    tags=["face"],
    dependencies=[Depends(require_api_key)],
)

MAX_FRAME_BYTES = 6 * 1024 * 1024  # 6 MB — mirrors NestJS multer limit


def _safe_detail(code: str, message: str) -> dict:
    """Maps an internal failure to a safe machine key + user message."""
    return {"code": code, "detail": message}


async def _read_limited(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_FRAME_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Frame too large")
    return data


def _analyze(frames_data: list[bytes], require_liveness: bool = True) -> dict:
    """Runs detection → quality → liveness → embedding. Never stores frames."""
    images: list = []
    for data in frames_data:
        try:
            images.append(detector.decode_image(data))
        except detector.FaceDetectionError as exc:
            raise HTTPException(status_code=422, detail=_safe_detail("invalid_image", str(exc))) from exc

    passed, reasons = quality.check_quality(images[0])
    if not passed:
        raise HTTPException(status_code=422, detail=_safe_detail(reasons[0], "Face quality check failed"))

    if require_liveness:
        live, live_reason = liveness.check_liveness(images)
        if not live:
            raise HTTPException(status_code=422, detail=_safe_detail(live_reason or "liveness_failed", "Liveness check failed"))

    try:
        sharpest = quality.pick_sharpest(images)
        face = detector.largest_face(sharpest)
        assert face is not None
        emb = embedding.embed_face(sharpest, face)
    except embedding.EmbeddingUnavailableError as exc:
        logger.error("Embedding unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=_safe_detail("ai_unavailable", "Face processing unavailable")) from exc

    return {
        "embedding": emb,
        "quality": {"passed": True, "reasons": []},
        "liveness": {"passed": True, "reason": None},
    }


@router.post("/enroll")
async def face_enroll(
    frame_a: Annotated[UploadFile, File(...)],
    frame_b: Annotated[UploadFile, File(...)],
) -> dict:
    """Validates quality + liveness and returns the enrollment embedding."""
    return _analyze([await _read_limited(frame_a), await _read_limited(frame_b)])


@router.post("/reference")
async def face_reference(frame_a: Annotated[UploadFile, File(...)]) -> dict:
    """Creates an enrollment embedding from one profile photo.

    Liveness is intentionally checked later from the live login camera frames.
    """
    return _analyze([await _read_limited(frame_a)], require_liveness=False)


@router.post("/embed")
async def face_embed(
    frame_a: Annotated[UploadFile, File(...)],
    frame_b: Annotated[UploadFile, File(...)],
) -> dict:
    """Computes a live embedding for comparison (liveness still enforced)."""
    return _analyze([await _read_limited(frame_a), await _read_limited(frame_b)])
