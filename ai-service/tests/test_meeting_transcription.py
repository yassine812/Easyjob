from pathlib import Path
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.meeting_transcription import router

app = FastAPI()
app.include_router(router, prefix='/ai')
client = TestClient(app)

def test_transcription_requires_internal_api_key(monkeypatch):
    monkeypatch.setenv('AI_API_KEY', 'test-key')
    response = client.post('/ai/interviews/transcribe', files={'file': ('audio.webm', b'audio', 'audio/webm')})
    assert response.status_code == 401

def test_transcription_reports_missing_local_model(monkeypatch):
    monkeypatch.delenv('AI_API_KEY', raising=False)
    monkeypatch.delenv('FASTER_WHISPER_MODEL_PATH', raising=False)
    assert client.post('/ai/interviews/transcribe', files={'file': ('audio.webm', b'audio', 'audio/webm')}).status_code == 503

def test_video_is_not_accepted(monkeypatch):
    monkeypatch.delenv('AI_API_KEY', raising=False)
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/local/model')
    assert client.post('/ai/interviews/transcribe', files={'file': ('video.webm', b'video', 'video/webm')}).status_code == 415

def test_audio_is_temporary_and_inference_is_bounded(monkeypatch):
    monkeypatch.delenv('AI_API_KEY', raising=False)
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/local/model')
    paths = []
    def transcribe(path, language, max_seconds):
        paths.append(path)
        assert Path(path).read_bytes() == b'audio'
        assert max_seconds == 30
        return {'available': True, 'text': 'Docker deployment', 'segments': [{'start': 0, 'end': 2, 'text': 'Docker deployment'}]}
    with patch('app.routers.meeting_transcription.transcribe', side_effect=transcribe):
        result = client.post('/ai/interviews/transcribe', files={'file': ('audio.webm', b'audio', 'audio/webm')})
    assert result.status_code == 200
    assert result.json()['text'] == 'Docker deployment'
    assert not Path(paths[0]).exists()

def test_transcription_passes_silero_vad_options(monkeypatch):
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/local/model')
    monkeypatch.setenv('INTERVIEW_VAD_ENABLED', 'true')
    calls = []
    def transcribe(path, language, max_seconds):
        calls.append((language, max_seconds))
        return {'available': True, 'text': 'Kubernetes', 'segments': [{'start': 1.0, 'end': 2.5, 'text': 'Kubernetes', 'confidence': -0.1}], 'vad': 'silero'}
    with patch('app.routers.meeting_transcription.transcribe', side_effect=transcribe):
        result = client.post('/ai/interviews/transcribe', files={'file': ('audio.webm', b'audio', 'audio/webm')})
    assert result.status_code == 200
    assert result.json()['vad'] == 'silero'
