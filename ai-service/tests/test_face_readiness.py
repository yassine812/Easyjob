from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.face.readiness import verify_models


def test_face_readiness_loads_and_runs_real_bundled_models():
    verify_models.cache_clear()
    response = TestClient(app).get('/health/face')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_http_liveness_does_not_hide_broken_face_models():
    with patch('app.face.readiness.verify_models', side_effect=RuntimeError('missing private path')):
        response = TestClient(app).get('/health/face')
        assert response.status_code == 503
        assert response.json() == {'detail': 'Face models unavailable'}
        assert TestClient(app).get('/health').status_code == 200
