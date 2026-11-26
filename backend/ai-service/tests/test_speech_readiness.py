import json
import sys
from threading import Event, Thread
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from app.interview_ai import resources, transcription


def test_readiness_responds_while_a_loader_holds_the_preload_lock(monkeypatch):
    held, release, timed_out = Event(), Event(), Event()
    monkeypatch.setitem(resources._state, 'loading', True)

    def loader():
        with resources._lock:
            held.set()
            if not release.wait(3):
                timed_out.set()

    thread = Thread(target=loader)
    thread.start()
    try:
        assert held.wait(3)
        assert resources.readiness()['loading'] is True
        assert not timed_out.is_set(), 'Readiness waited for the model-loading lock'
    finally:
        release.set()
        thread.join(3)


def test_recording_during_startup_returns_warming_without_loading_twice(monkeypatch):
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/models/local')
    monkeypatch.setitem(resources._state, 'loading', True)
    load = Mock(side_effect=AssertionError('A second model must not load'))
    monkeypatch.setattr(transcription, '_model', load)
    result = transcription.transcribe('synthetic.wav', language='en')
    assert result['available'] is False
    assert 'warming' in result['reason']
    load.assert_not_called()


def test_a_configured_path_is_not_reported_as_ready_speech(monkeypatch):
    from app.main import interview_readiness
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/models/local')
    monkeypatch.setattr(resources, '_state', {**resources._state,
        'initialized': True, 'loading': False, 'tfidf': True, 'embeddings': True, 'stt': False})
    response = interview_readiness()
    assert response.status_code == 503
    body = json.loads(response.body)
    assert body['stt_configured'] is True
    assert body['stt'] is False
    assert body['status'] == 'degraded'


def test_speech_warmup_initializes_the_same_cached_model(monkeypatch):
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/models/local')
    load = Mock(return_value=object())
    monkeypatch.setattr(transcription, '_model', load)
    assert transcription.preload_model() is True
    load.assert_called_once_with('/models/local')


@pytest.mark.parametrize('speech_available', [True, False])
def test_startup_records_the_actual_speech_loading_result(monkeypatch, tmp_path, speech_available):
    monkeypatch.setenv('FASTER_WHISPER_MODEL_PATH', '/models/local')
    monkeypatch.setattr(resources, 'MODEL_PATH', tmp_path)
    monkeypatch.setattr(resources, '_state', {**resources._state,
        'initialized': False, 'loading': False, 'tfidf': False, 'embeddings': False, 'stt': False})
    monkeypatch.setattr(resources, '_embedding_model', None)
    monkeypatch.setattr(resources, '_model_instance_count', 0)
    monkeypatch.setitem(sys.modules, 'sentence_transformers', SimpleNamespace(SentenceTransformer=Mock(return_value=object())))
    speech = Mock(return_value=True) if speech_available else Mock(side_effect=RuntimeError('model failed'))
    monkeypatch.setattr(transcription, 'preload_model', speech)
    result = resources.preload(allow_download=False)
    assert result['initialized'] is True
    assert result['loading'] is False
    assert result['stt'] is speech_available
    speech.assert_called_once_with()
