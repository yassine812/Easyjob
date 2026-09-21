"""Face authentication pipeline tests.

Covers: detection, quality, liveness, embedding, matching, API-key auth,
malformed/oversized input. Uses real images (public-domain portraits) in
tests/fixtures — no synthetic or fake JPEGs.
"""

from __future__ import annotations

import io
import os
import struct

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.face.matcher import cosine_similarity
from app.main import app

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

client = TestClient(app)

# Match threshold mirrors FACE_MATCH_THRESHOLD default in the backend.
THRESHOLD = 0.5


def _load(name: str, width: int | None = None) -> np.ndarray:
    img = cv2.imread(os.path.join(FIXTURES, name))
    assert img is not None, f"fixture missing: {name}"
    if width:
        h, w = img.shape[:2]
        img = cv2.resize(img, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)
    return img


def _jpg(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def _shift(img: np.ndarray, dx: int = 6, dy: int = 3) -> np.ndarray:
    """Translates the image a few px — mimics natural head movement."""
    m = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(img, m, (img.shape[1], img.shape[0]), borderMode=cv2.BORDER_REPLICATE)


def _post(path: str, frame_a: bytes, frame_b: bytes, key: str | None = None) -> object:
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    return client.post(
        path,
        files={"frame_a": ("a.jpg", frame_a, "image/jpeg"), "frame_b": ("b.jpg", frame_b, "image/jpeg")},
        headers=headers,
    )


# ---------------------------------------------------------------------------
# API key protection (mirrors the existing /ai protection)
# ---------------------------------------------------------------------------


def test_face_endpoints_require_api_key_when_configured(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "face-secret")
    face = _load("astronaut.png", 400)
    r = _post("/ai/face/enroll", _jpg(face), _jpg(_shift(face)))
    assert r.status_code == 401
    r = _post("/ai/face/enroll", _jpg(face), _jpg(_shift(face)), key="face-secret")
    assert r.status_code == 200
    monkeypatch.delenv("AI_API_KEY")


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------


def test_enroll_valid_two_frames():
    face = _load("astronaut.png", 400)
    r = _post("/ai/face/enroll", _jpg(face), _jpg(_shift(face)))
    assert r.status_code == 200, r.text
    body = r.json()
    emb = body["embedding"]
    assert isinstance(emb, list) and len(emb) == 128
    assert all(isinstance(v, float) for v in emb)
    assert abs(np.linalg.norm(emb) - 1.0) < 0.01  # L2-normalized
    assert body["quality"]["passed"] is True
    assert body["liveness"]["passed"] is True


def test_enroll_no_face():
    # Sharp (textured) but faceless — must report no_face, not low_quality.
    textured = np.random.default_rng(7).integers(0, 255, size=(400, 400, 3), dtype=np.uint8)
    r = _post("/ai/face/enroll", _jpg(textured), _jpg(_shift(textured)))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "no_face"


def test_enroll_blank_frame_is_low_quality():
    blank = np.full((400, 400, 3), 200, dtype=np.uint8)
    r = _post("/ai/face/enroll", _jpg(blank), _jpg(blank))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "low_quality"


def test_enroll_multiple_faces():
    face = _load("astronaut.png", 400)
    two = np.hstack([face, face])
    r = _post("/ai/face/enroll", _jpg(two), _jpg(_shift(two, 4)))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "multiple_faces"


def test_enroll_low_quality_blurred():
    face = _load("astronaut.png", 400)
    blurred = cv2.GaussianBlur(face, (31, 31), 0)
    r = _post("/ai/face/enroll", _jpg(blurred), _jpg(_shift(blurred, 4)))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "low_quality"


def test_enroll_face_too_small():
    face = _load("astronaut.png", 400)
    canvas = np.full((2000, 2000, 3), 190, dtype=np.uint8)
    canvas[800:1200, 800:1200] = face  # face ~86px in a 2000px frame
    r = _post("/ai/face/enroll", _jpg(canvas), _jpg(_shift(canvas, 5)))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "face_too_small"


def test_enroll_static_photo_replay_rejected():
    """Two identical frames = a printed/still photo → liveness fails."""
    face = _load("astronaut.png", 400)
    same = _jpg(face)
    r = _post("/ai/face/enroll", same, same)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "no_motion"


def test_enroll_malformed_image():
    face = _load("astronaut.png", 400)
    junk = b"\x00\x01\x02not-a-real-jpeg" * 100
    r = _post("/ai/face/enroll", junk, _jpg(_shift(face, 4)))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "invalid_image"


def test_enroll_oversized_frame():
    face = _load("astronaut.png", 400)
    big = _jpg(face) + b"\x00" * (6 * 1024 * 1024 + 1)  # > 6 MB
    r = _post("/ai/face/enroll", big, _jpg(_shift(face, 4)))
    assert r.status_code == 413


# ---------------------------------------------------------------------------
# Matching (NestJS makes the decision; here we validate the metric + model)
# ---------------------------------------------------------------------------


def test_same_identity_matches():
    a = _load("astronaut.png", 400)
    # A different capture of the same person: slight rotation + exposure change.
    m = cv2.getRotationMatrix2D((200, 200), 3, 1.0)
    b = cv2.convertScaleAbs(
        cv2.warpAffine(a, m, (400, 400), borderMode=cv2.BORDER_REPLICATE), alpha=1.05, beta=10
    )
    ra = _post("/ai/face/embed", _jpg(a), _jpg(_shift(a)))
    rb = _post("/ai/face/embed", _jpg(b), _jpg(_shift(b)))
    assert ra.status_code == 200 and rb.status_code == 200, (ra.text, rb.text)
    sim = cosine_similarity(ra.json()["embedding"], rb.json()["embedding"])
    assert sim >= THRESHOLD


def test_different_identity_rejected():
    astronaut = _load("astronaut.png", 400)
    einstein = _load("einstein.jpg", 300)
    ra = _post("/ai/face/embed", _jpg(astronaut), _jpg(_shift(astronaut)))
    re = _post("/ai/face/embed", _jpg(einstein), _jpg(_shift(einstein)))
    assert ra.status_code == 200 and re.status_code == 200
    sim = cosine_similarity(ra.json()["embedding"], re.json()["embedding"])
    assert sim < THRESHOLD


def test_embed_rejects_no_liveness():
    """Login path still enforces liveness — a still photo cannot log in."""
    face = _load("astronaut.png", 400)
    same = _jpg(face)
    r = _post("/ai/face/embed", same, same)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "no_motion"


# ---------------------------------------------------------------------------
# Direct module behavior
# ---------------------------------------------------------------------------


def test_cosine_similarity_edges():
    assert cosine_similarity([], []) == 0.0
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert abs(cosine_similarity([0.5, 0.5], [0.5, 0.5]) - 1.0) < 1e-9
