"""Face detection.

Uses Haar cascades with a bundled YuNet fallback (CPU-only, no runtime downloads).
Returns raw face rectangles; callers decide how many faces are acceptable.

Existing Haar crops are preserved for compatibility with enrolled templates.
YuNet handles camera faces that the cascades miss, including soft captures.
"""

from __future__ import annotations

from pathlib import Path
from threading import local

import cv2
import numpy as np

# Min face size (px) — below this we reject as "face too small".
MIN_FACE_SIZE = 80

_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_profile_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_profileface.xml"
)
_thread_models = local()


def _detect_yunet(img: np.ndarray, min_size: int) -> list[tuple[int, int, int, int]]:
    """Fallback detector; keep mutable DNN input dimensions local to each thread."""
    model = getattr(_thread_models, "yunet", None)
    if model is None:
        model = cv2.FaceDetectorYN.create(
            str(Path(__file__).parent / "models" / "face_detection_yunet_2023mar.onnx"),
            "", (320, 320), 0.9, 0.3, 5000,
        )
        _thread_models.yunet = model
    height, width = img.shape[:2]
    scale = min(1.0, 640 / max(height, width))
    resized = cv2.resize(img, (round(width * scale), round(height * scale))) if scale < 1 else img
    model.setInputSize((resized.shape[1], resized.shape[0]))
    _, faces = model.detect(resized)
    if faces is None:
        return []
    boxes = []
    for face in faces:
        x, y, w, h = face[:4] / scale
        left, top = max(0, round(float(x))), max(0, round(float(y)))
        right, bottom = min(width, round(float(x + w))), min(height, round(float(y + h)))
        if min(right - left, bottom - top) >= min_size:
            boxes.append((left, top, right - left, bottom - top))
    return boxes


class FaceDetectionError(ValueError):
    """Raised when an image cannot be decoded (not when no face is found)."""


def decode_image(data: bytes) -> np.ndarray:
    """Decodes JPEG/PNG bytes into a BGR image. Raises FaceDetectionError."""
    if not data:
        raise FaceDetectionError("Empty image data")
    buf = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise FaceDetectionError("Could not decode image (unsupported or corrupt)")
    return img


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx1, by1, bx2, by2 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / union if union > 0 else 0.0


def detect_faces(img: np.ndarray, min_size: int = MIN_FACE_SIZE) -> list[tuple[int, int, int, int]]:
    """Returns (x, y, w, h) rectangles of detected frontal faces.

    Haar occasionally emits a tiny false-positive box that overlaps the real
    face (borderline scales). Heavily overlapping boxes are merged into the
    largest member so a single face is never reported as multiple.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    rects = _cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=6,
        minSize=(min_size, min_size),
    )
    boxes = [tuple(int(v) for v in r) for r in rects]
    # A valid profile picture can be slightly turned. When the frontal model
    # finds nothing, try the profile model in both directions before rejecting
    # the image as faceless.
    if not boxes:
        profile = _profile_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_size, min_size)
        )
        boxes.extend(tuple(int(v) for v in r) for r in profile)
        flipped = cv2.flip(gray, 1)
        mirrored = _profile_cascade.detectMultiScale(
            flipped, scaleFactor=1.1, minNeighbors=5, minSize=(min_size, min_size)
        )
        width = gray.shape[1]
        boxes.extend((width - int(x) - int(w), int(y), int(w), int(h)) for x, y, w, h in mirrored)

    if not boxes:
        return _detect_yunet(img, min_size)

    groups: list[list[tuple[int, int, int, int]]] = []
    for box in sorted(boxes, key=lambda b: b[2] * b[3], reverse=True):
        placed = False
        for group in groups:
            if any(_iou(box, member) >= 0.3 for member in group):
                group.append(box)
                placed = True
                break
        if not placed:
            groups.append([box])
    merged = [max(group, key=lambda b: b[2] * b[3]) for group in groups]

    # Haar can emit a spurious extra box depending on the calling thread
    # (borderline scale). Confirm with a stricter cascade pass when more than
    # one box survives: a genuine face still passes minNeighbors=9, spurious
    # boxes usually vanish. Deterministic rule: same input → same decision.
    if len(merged) > 1:
        strict = _cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=9,
            minSize=(min_size, min_size),
        )
        strict_boxes = [tuple(int(v) for v in r) for r in strict]
        if len(strict_boxes) == 1:
            return strict_boxes
    return merged


def largest_face(img: np.ndarray) -> tuple[int, int, int, int] | None:
    """Largest detected face, or None if none found."""
    faces = detect_faces(img)
    if not faces:
        return None
    return max(faces, key=lambda r: r[2] * r[3])
