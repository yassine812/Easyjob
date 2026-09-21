from types import SimpleNamespace
import httpx
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_provider

client = TestClient(app)


def test_provider_rate_limit_returns_unavailable_without_leaking_details(monkeypatch):
    response = httpx.Response(429, request=httpx.Request('POST', 'https://provider.test'))
    failure = httpx.HTTPStatusError('private provider details', request=response.request, response=response)
    chat = AsyncMock(side_effect=failure)
    monkeypatch.setattr('app.providers.openai._chat', chat)
    app.dependency_overrides[get_provider] = lambda: SimpleNamespace(name='openai')
    try:
        result = client.post('/ai/recruitment', json={'task': 'questions'})
        assert result.status_code == 503
        assert 'private provider details' not in result.text
        assert chat.await_count == 1
    finally:
        app.dependency_overrides.clear()

def test_unconfigured_generation_returns_unavailable():
    app.dependency_overrides[get_provider] = lambda: SimpleNamespace(name='rule_based')
    try:
        result = client.post('/ai/recruitment', json={'task': 'questions', 'locale': 'fr'})
        assert result.status_code == 503
    finally:
        app.dependency_overrides.clear()

def test_structured_report_requires_human_decision(monkeypatch):
    chat = AsyncMock(return_value={'content': 'The answer describes an API design.', 'technical': 85,
                                  'communication': 80, 'strengths': ['Concrete example'], 'gaps': ['No test strategy']})
    monkeypatch.setattr('app.providers.openai._chat', chat)
    app.dependency_overrides[get_provider] = lambda: SimpleNamespace(name='openai')
    try:
        response = client.post('/ai/recruitment', json={'task': 'report', 'locale': 'fr',
            'job': {'title': 'Engineer'}, 'evidence': {'questions': ['Explain your API'], 'answers': ['I use REST.']}})
        assert response.status_code == 200
        assert response.json()['humanDecisionRequired'] is True
        assert response.json()['technical'] == 85
        assert 'Never infer race' in str(chat.call_args)
        assert 'clarity of the submitted text only' in str(chat.call_args)
    finally:
        app.dependency_overrides.clear()

def test_invalid_scores_are_rejected(monkeypatch):
    monkeypatch.setattr('app.providers.openai._chat', AsyncMock(return_value={'content': 'Invalid', 'technical': 140}))
    app.dependency_overrides[get_provider] = lambda: SimpleNamespace(name='openai')
    try:
        assert client.post('/ai/recruitment', json={'task': 'report'}).status_code == 502
    finally:
        app.dependency_overrides.clear()

def test_recruitment_endpoint_requires_server_key(monkeypatch):
    monkeypatch.setenv('AI_API_KEY', 'isolated-test-secret')
    assert client.post('/ai/recruitment', json={'task': 'questions'}).status_code == 401
