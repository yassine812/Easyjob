"""Local speech only. Audio is temporary; no video or biometric analysis."""
import os
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from starlette.concurrency import run_in_threadpool
from app.auth import require_api_key
from app.interview_ai.transcription import transcribe

router = APIRouter(dependencies=[Depends(require_api_key)])

@router.post('/interviews/transcribe')
async def meeting_transcription(file: UploadFile = File(...), language: str | None = Query(default=None, pattern='^(fr|en|ar)?$')):
    if not os.getenv('FASTER_WHISPER_MODEL_PATH'):
        raise HTTPException(503, 'Local speech model not configured')
    if file.content_type not in ('audio/webm', 'audio/ogg', 'audio/mp4'):
        raise HTTPException(415, 'Unsupported audio')
    content = await file.read(5 * 1024 * 1024 + 1)
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, 'Invalid audio size')
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as audio:
            audio.write(content)
            path = audio.name
        result = await run_in_threadpool(transcribe, path, language or None, 30)
        if not result.get('available'):
            raise HTTPException(503, 'Local transcription unavailable')
        return result
    finally:
        if path:
            Path(path).unlink(missing_ok=True)
