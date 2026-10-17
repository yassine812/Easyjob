"""Optional offline transcription. Never calls a hosted speech API."""
from __future__ import annotations
import os
from functools import lru_cache
from threading import Lock
_lock = Lock()
@lru_cache(maxsize=1)
def _model(path):
    from faster_whisper import WhisperModel
    return WhisperModel(path, device="cpu", compute_type="int8", local_files_only=True)

def transcribe(audio_path: str, language: str | None = None, max_seconds: int | None = None) -> dict:
    model_path = os.getenv('FASTER_WHISPER_MODEL_PATH')
    if not model_path:
        return {'available': False, 'reason': 'Set FASTER_WHISPER_MODEL_PATH to a local model directory.', 'text': ''}
    try:
        with _lock:
            model = _model(model_path)
            options = {'vad_filter': os.getenv('INTERVIEW_VAD_ENABLED', 'true').lower() in ('true', '1')}
            if options['vad_filter']:
                # faster-whisper's VAD filter is the bundled Silero VAD path.
                options['vad_parameters'] = {'min_silence_duration_ms': int(os.getenv('SILERO_VAD_MIN_SILENCE_MS', '450'))}
            if max_seconds:
                options['clip_timestamps'] = f'0,{max_seconds}'
            segments, _ = model.transcribe(audio_path, language=language, **options)
            items = [{'start': segment.start, 'end': segment.end, 'text': segment.text.strip()} for segment in segments]
        return {'available': True, 'text': ' '.join(segment['text'] for segment in items).strip(), 'segments': items, 'engine': 'faster-whisper-local', 'vad': 'silero' if options['vad_filter'] else 'disabled'}
    except Exception as error:
        return {'available': False, 'reason': type(error).__name__, 'text': ''}
