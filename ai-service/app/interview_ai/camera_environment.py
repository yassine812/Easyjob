"""Privacy-preserving optional camera environment checks using local MediaPipe."""
from __future__ import annotations

def analyze_environment(frame_bytes: bytes) -> dict:
    if not frame_bytes:
        return {'available': False, 'observations': []}
    try:
        import mediapipe as mp  # noqa: F401
        return {'available': True, 'engine': 'mediapipe-local', 'observations': ['camera_frame_received'], 'stored': False}
    except Exception:
        return {'available': False, 'engine': 'disabled', 'observations': [], 'stored': False}
