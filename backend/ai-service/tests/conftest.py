"""Keep unit/API tests independent of a developer's real provider credentials."""
import pytest
import app.dependencies as dependencies


@pytest.fixture(autouse=True)
def isolated_provider(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "rule_based")
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    dependencies._active_provider = None
    yield
    dependencies._active_provider = None
