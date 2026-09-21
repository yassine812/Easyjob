"""Similarity matching for face embeddings.

The authoritative match decision is made in NestJS against the stored
(encrypted) template. This module exists for symmetry and tests: both sides
use the same cosine-similarity metric so a threshold chosen here (or in
FACE_MATCH_THRESHOLD) behaves identically.

Cosine similarity: 1.0 = identical direction, 0.0 = orthogonal.
"""

from __future__ import annotations


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm_a * norm_b)))
