"""Face quality checks.

Rejects frames that would produce a useless template: blurry, too small,
extreme aspect (proxy for angle), or zero/multiple faces. Messages are the
stable machine keys that NestJS maps to safe user-facing text.

All thresholds are conservative defaults; tune via module constants.
"""

from __future__ import annotations

import cv2
import numpy as np

from .detector import MIN_FACE_SIZE, detect_faces

# Minimum Laplacian variance (sharpness) for an acceptable frame.
MIN_SHARPNESS = 80.0
# Minimum face dimension (px).
MIN_FACE_DIM = MIN_FACE_SIZE
# Face aspect range (w/h) — extreme values imply a strong profile/angle.
MIN_ASPECT = 0.45
MAX_ASPECT = 2.2
# Face must cover at least this fraction of the image area.
MIN_AREA_RATIO = 0.015


def sharpness(img: np.ndarray) -> float:
    """Laplacian variance — higher is sharper. ~0 means blurry/blank."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def check_quality(img: np.ndarray) -> tuple[bool, list[str]]:
    """Returns (passed, reasons). Reasons are stable machine keys."""
    reasons: list[str] = []

    faces = detect_faces(img)
    if len(faces) == 0:
        # Without a detected face we cannot judge facial sharpness. A plain
        # background must not turn a detector miss into a misleading blur error.
        return (False, ["no_face"])

    if len(faces) > 1:
        return (False, ["multiple_faces"])

    x, y, w, h = faces[0]
    if min(w, h) < MIN_FACE_DIM:
        reasons.append("face_too_small")
    if (w * h) / (img.shape[0] * img.shape[1]) < MIN_AREA_RATIO:
        reasons.append("face_too_small")
    aspect = w / max(h, 1)
    if aspect < MIN_ASPECT or aspect > MAX_ASPECT:
        reasons.append("bad_angle")

    # Sharpness is measured on the face region only — a webcam frame of a
    # person against a plain wall is mostly flat background, and global
    # Laplacian variance would falsely reject it as blurry.
    crop = img[max(0, y - int(h * 0.25)) : y + h + int(h * 0.25), max(0, x - int(w * 0.25)) : x + w + int(w * 0.25)]
    if crop.size > 0 and sharpness(crop) < MIN_SHARPNESS:
        reasons.append("low_quality")

    return (len(reasons) == 0, reasons)


def pick_sharpest(images: list[np.ndarray]) -> np.ndarray:
    """Returns the sharpest frame — used for the embedding input."""
    return max(images, key=lambda im: sharpness(im))
