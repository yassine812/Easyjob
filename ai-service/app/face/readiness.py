"""Readiness exercises bundled face models without collecting any camera data."""
from functools import lru_cache
import numpy as np
from app.face import detector, embedding


@lru_cache(maxsize=1)
def verify_models() -> None:
    if detector._cascade.empty() or detector._profile_cascade.empty():
        raise RuntimeError('Face cascade model unavailable')
    synthetic = np.zeros((320, 320, 3), dtype=np.uint8)
    detector._detect_yunet(synthetic, detector.MIN_FACE_SIZE)
    vector = embedding.embed_face(synthetic, (80, 80, 160, 160))
    if len(vector) != 128 or not np.isfinite(vector).all():
        raise RuntimeError('Face embedding model unavailable')
