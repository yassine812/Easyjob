import asyncio
import threading
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from patch_server import BLOCKING, LEGACY, patch, patch_llama
import os


def app_for(loader, legacy=False):
    source = ('from contextlib import asynccontextmanager\nimport asyncio\n'
              'from fastapi import FastAPI, WebSocket\n' + (LEGACY if legacy else BLOCKING)
              + '\napp = FastAPI(lifespan=lifespan)\n'
              + '@app.websocket("/ws")\nasync def websocket_endpoint(ws: WebSocket):\n'
                '    await ws.accept()\n    await ws.send_text("ready")\n')
    namespace = {'load_models': loader, 'llama': SimpleNamespace(stop=lambda: None)}
    exec(patch(source), namespace)
    return namespace['app']


def await_status(client, expected):
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        response = client.get('/health/ready')
        if response.json()['status'] == expected:
            return response
        time.sleep(.01)
    pytest.fail(f'Model state never became {expected}')


def test_loading_is_not_reported_ready_and_websockets_wait():
    release = threading.Event()
    app = app_for(lambda: release.wait(3))
    try:
        with TestClient(app) as client:
            assert client.get('/health/ready').status_code == 503
            with pytest.raises(WebSocketDisconnect) as error:
                with client.websocket_connect('/ws'):
                    pass
            assert error.value.code == 1013
            release.set()
            assert await_status(client, 'ready').status_code == 200
    finally:
        release.set()


def test_model_failure_remains_unavailable():
    def fail():
        raise RuntimeError('Model failed to load')
    with TestClient(app_for(fail)) as client:
        response = await_status(client, 'unavailable')
        assert response.status_code == 503
        assert response.json() == {'status': 'unavailable'}


def test_loaded_models_allow_the_real_websocket_handler():
    with TestClient(app_for(lambda: None, legacy=True)) as client:
        assert await_status(client, 'ready').status_code == 200
        with client.websocket_connect('/ws') as websocket:
            assert websocket.receive_text() == 'ready'


def test_patch_is_idempotent_and_rejects_unknown_upstream():
    source = ('from fastapi import FastAPI, WebSocket\n' + BLOCKING
              + '\napp = FastAPI(lifespan=lifespan)\n'
                'async def websocket_endpoint(ws: WebSocket):\n    await ws.accept()')
    assert patch(patch(source)) == patch(source)
    with pytest.raises(ValueError, match='Unexpected Parlor source'):
        patch('incompatible upstream revision')


@pytest.mark.parametrize('warmup', ['true', 'false'])
def test_cpu_startup_options_keep_model_arguments_and_allow_warmup_override(monkeypatch, warmup):
    monkeypatch.setenv('LLAMA_WARMUP', warmup)
    monkeypatch.setenv('LLAMA_THREADS', '3')
    source = '''def command(cmd, model, mmproj, port, ctx):
    return (
        cmd + ["-m", model, "--mmproj", mmproj, "-ngl", "99",
               "--port", str(port), "-c", str(ctx), "-np", "1"]
    )
'''
    transformed = patch_llama(source)
    namespace = {'os': os}
    exec(transformed, namespace)
    command = namespace['command'](['/llama-server'], '/model.gguf', '/vision.gguf', 8081, 4096)
    assert ('--no-warmup' in command) == (warmup == 'false')
    assert command[command.index('-m') + 1] == '/model.gguf'
    assert command[command.index('--mmproj') + 1] == '/vision.gguf'
    assert command[command.index('-t') + 1] == '3'
    assert command[command.index('-c') + 1] == '4096'
    assert patch_llama(transformed) == transformed
