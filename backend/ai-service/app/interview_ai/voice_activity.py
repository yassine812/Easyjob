"""Optional local Silero VAD with a deterministic energy fallback."""
from __future__ import annotations
from functools import lru_cache
import os

@lru_cache(maxsize=1)
def _silero():
    if os.getenv('INTERVIEW_VAD_ENABLED', 'true').lower() not in ('true', '1'):
        return None
    try:
        from silero_vad import get_speech_timestamps, load_silero_vad
        return load_silero_vad(), get_speech_timestamps
    except Exception:
        return None

def speech_probability(samples: list[float], sample_rate: int = 16000) -> dict:
    if not samples:
        return {'speech': False, 'probability': 0.0, 'engine': 'silero' if _silero() else 'energy'}
    loaded = _silero()
    if loaded:
        try:
            import torch
            model, get_speech_timestamps = loaded
            timestamps = get_speech_timestamps(torch.tensor(samples, dtype=torch.float32), model, sampling_rate=sample_rate)
            speech = bool(timestamps)
            return {'speech': speech, 'probability': 1.0 if speech else 0.0, 'sample_rate': sample_rate, 'engine': 'silero'}
        except Exception:
            pass
    energy = sum(value * value for value in samples) / len(samples)
    # Keep a simple offline fallback available when Silero is not packaged.
    return {'speech': energy > 0.00015, 'probability': min(1.0, energy / .003), 'sample_rate': sample_rate, 'engine': 'energy'}
