import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _unset_key(monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)


def test_health_is_open_when_no_key_configured():
    assert client.get("/health").status_code == 200


def test_endpoints_require_key_when_configured(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "super-secret-ai-key")
    # Recreate the client so the dependency sees the new env.
    from app.main import app as app2

    guarded = TestClient(app2)

    no_auth = guarded.post("/ai/cv/analyze", json={"text": "CV"})
    assert no_auth.status_code == 401

    wrong = guarded.post(
        "/ai/cv/analyze",
        json={"text": "CV"},
        headers={"Authorization": "Bearer wrong-key"},
    )
    assert wrong.status_code == 401

    ok = guarded.post(
        "/ai/cv/analyze",
        json={"text": "CV"},
        headers={"Authorization": "Bearer super-secret-ai-key"},
    )
    assert ok.status_code == 200
