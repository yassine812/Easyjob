"""Cache EasyJob's local multilingual embedding model during setup/deployment."""
from __future__ import annotations

from app.interview_ai.resources import MODEL_CACHE, MODEL_NAME, MODEL_PATH, preload, readiness


def cache_size_bytes(root=MODEL_CACHE) -> int:
    # Hugging Face snapshots are hard links to blobs. Count each file identity
    # once so the reported disk footprint is not doubled.
    seen, total = set(), 0
    for path in root.rglob("*"):
        if path.is_file():
            stat = path.stat()
            identity = (stat.st_dev, stat.st_ino)
            if identity not in seen:
                seen.add(identity)
                total += stat.st_size
    return total


if __name__ == "__main__":
    if MODEL_PATH is not None:
        from huggingface_hub import snapshot_download
        # This is the explicit image/setup-time download. Runtime loading uses
        # only this fully materialized directory and is offline by default.
        snapshot_download(MODEL_NAME, local_dir=str(MODEL_PATH))
    state = preload(allow_download=True)
    if not state["embeddings"]:
        raise SystemExit(f"Could not cache {MODEL_NAME}: {state['embedding_error']}")
    root = MODEL_PATH or MODEL_CACHE
    size = cache_size_bytes(root)
    print({"model": MODEL_NAME, "cache": str(root), "size_mb": round(size / 1024 / 1024, 1), **readiness()})
