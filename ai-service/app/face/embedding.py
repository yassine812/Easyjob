"""Face embedding — OpenFace NN4 small2 (128-d, CPU-only).

Model: nn4.small2.v1.t7 (BSD-3-Clause, CMU OpenFace project).
Embeddings are L2-normalized; cosine similarity in [0, 1] is used for
matching (see matcher.py). The model runs entirely on CPU via OpenCV's DNN
module — no GPU required, no runtime model download (file is shipped in
app/face/models/).

The raw embedding is returned ONLY to the NestJS backend, which encrypts it
(AES-256-GCM) before storage. This service never stores or logs embeddings.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from threading import Lock

import cv2
import numpy as np

logger = logging.getLogger("ai-service.face.embedding")

MODEL_PATH = Path(__file__).parent / "models" / "openface.nn4.small2.v1.t7"
# OpenFace expects a 96x96 aligned RGB crop normalized to [0, 1].
INPUT_SIZE = 96
_inference_lock = Lock()


class EmbeddingUnavailableError(RuntimeError):
    """Raised when the embedding model file is missing or unreadable."""


@lru_cache(maxsize=1)
def _load_net():
    if not MODEL_PATH.exists():
        raise EmbeddingUnavailableError(
            f"Embedding model not found at {MODEL_PATH} — AI service is misconfigured"
        )
    try:
        net = cv2.dnn.readNetFromTorch(str(MODEL_PATH))
    except Exception as exc:  # noqa: BLE001
        raise EmbeddingUnavailableError(f"Could not load embedding model: {exc}") from exc
    return net


def _crop_face(img: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """Crops the face with a 25% margin and resizes to 96x96."""
    h, w = img.shape[:2]
    x, y, bw, bh = box
    margin_x = int(bw * 0.25)
    margin_y = int(bh * 0.25)
    x0, y0 = max(0, x - margin_x), max(0, y - margin_y)
    x1, y1 = min(w, x + bw + margin_x), min(h, y + bh + margin_y)
    crop = img[y0:y1, x0:x1]
    return cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)


def embed_face(img: np.ndarray, box: tuple[int, int, int, int]) -> list[float]:
    """Computes the 128-d L2-normalized embedding of the detected face."""
    net = _load_net()
    crop = _crop_face(img, box)
    blob = cv2.dnn.blobFromImage(crop, 1.0 / 255.0, (INPUT_SIZE, INPUT_SIZE), (0, 0, 0), swapRB=True)
    # Health probes and concurrent requests must not overwrite a shared DNN input.
    with _inference_lock:
        net.setInput(blob)
        out = net.forward()  # (1, 128)
    vec = out.reshape(-1).astype(np.float64)
    norm = float(np.linalg.norm(vec))
    if norm < 1e-8:
        raise EmbeddingUnavailableError("Embedding model produced a zero vector")
    return [round(float(v / norm), 6) for v in vec]
