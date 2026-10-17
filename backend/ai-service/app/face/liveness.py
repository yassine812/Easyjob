"""Passive liveness — basic anti-spoofing.

Two frames captured ~0.5-1 s apart must both contain exactly one face, the
faces must overlap (same person, roughly the same position), and the face
must move a little (a static photo yields near-identical frames).

This defeats simple static-photo replay. It is NOT robust against a video
of the victim or a sophisticated 3D mask — see docs/PRIVACY.md for the
honest limitation statement. The strategy is isolated here so a stronger
passive/active liveness model can replace it later without touching NestJS.
"""

from __future__ import annotations

import numpy as np

from .detector import detect_faces


def _box(b: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x, y, w, h = b
    return (x, y, x + w, y + h)


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = _box(a)
    bx1, by1, bx2, by2 = _box(b)
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / union if union > 0 else 0.0


def check_liveness(images: list[np.ndarray]) -> tuple[bool, str | None]:
    """Returns (passed, reason). Reason is a stable machine key."""
    if len(images) < 2:
        return (False, "insufficient_frames")

    boxes = []
    for img in images:
        faces = detect_faces(img)
        if not faces:
            return (False, "no_face")
        if len(faces) != 1:
            return (False, "face_count_changed")
        boxes.append(faces[0])

    a, b = boxes[0], boxes[1]
    if _iou(a, b) < 0.45:
        return (False, "face_moved")

    # Face center displacement as a fraction of image width — must show a
    # little natural motion but not a teleport between frames.
    img_w = images[0].shape[1]
    ca = (a[0] + a[2] / 2, a[1] + a[3] / 2)
    cb = (b[0] + b[2] / 2, b[1] + b[3] / 2)
    dx, dy = abs(ca[0] - cb[0]), abs(ca[1] - cb[1])
    displacement = (dx + dy) / 2 / max(img_w, 1)

    if displacement < 0.002:
        return (False, "no_motion")  # identical frames → static photo replay
    if displacement > 0.25:
        return (False, "face_moved")  # too much movement for a guided scan

    return (True, None)
