import hashlib
import importlib.util
import io
from pathlib import Path

import pytest


@pytest.fixture
def cache(monkeypatch):
    script = Path(__file__).resolve().parents[1] / "scripts" / "cache_face_models.py"
    spec = importlib.util.spec_from_file_location("face_model_cache", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module.time, "sleep", lambda _: None)
    return module


def test_reuses_verified_model_without_network(cache, monkeypatch, tmp_path):
    target = tmp_path / "face.onnx"
    target.write_bytes(b"verified model")
    monkeypatch.setattr(cache, "urlopen", lambda *a, **k: pytest.fail("Unexpected network request"))
    cache.cache_model(target, "https://models.invalid/face", hashlib.sha256(target.read_bytes()).hexdigest())


def test_downloads_and_atomically_installs_matching_model(cache, monkeypatch, tmp_path):
    content = b"verified model"
    target = tmp_path / "face.onnx"
    monkeypatch.setattr(cache, "urlopen", lambda *a, **k: io.BytesIO(content))
    cache.cache_model(target, "https://models.invalid/face", hashlib.sha256(content).hexdigest())
    assert target.read_bytes() == content
    assert not target.with_suffix(".onnx.download").exists()


def test_corrupt_download_never_replaces_existing_model(cache, monkeypatch, tmp_path):
    target = tmp_path / "face.onnx"
    target.write_bytes(b"previous model")
    monkeypatch.setattr(cache, "urlopen", lambda *a, **k: io.BytesIO(b"corrupt payload"))
    with pytest.raises(ValueError, match="Checksum mismatch"):
        cache.cache_model(target, "https://models.invalid/face", "0" * 64)
    assert target.read_bytes() == b"previous model"
    assert not target.with_suffix(".onnx.download").exists()


def test_retries_transient_download_failure(cache, monkeypatch, tmp_path):
    attempts = []
    content = b"verified model"

    def download(*args, **kwargs):
        attempts.append(True)
        if len(attempts) == 1:
            raise TimeoutError("transient failure")
        return io.BytesIO(content)

    monkeypatch.setattr(cache, "urlopen", download)
    target = tmp_path / "face.onnx"
    cache.cache_model(target, "https://models.invalid/face", hashlib.sha256(content).hexdigest())
    assert target.read_bytes() == content
    assert len(attempts) == 2
