"""Face authentication pipeline (CPU-only, OpenCV-based).

Components are intentionally modular so the embedding model or liveness
strategy can be swapped for a stronger provider later without touching the
NestJS integration surface (see docs/PRIVACY.md for limitations).
"""
