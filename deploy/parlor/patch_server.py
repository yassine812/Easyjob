"""Apply the small EasyJob lifecycle adapter to the pinned upstream Parlor server."""
from pathlib import Path
import sys


def patch_llama(source: str) -> str:
    if '# EasyJob CPU startup' in source:
        return source
    original = 'cmd + ["-m", model, "--mmproj", mmproj, "-ngl", "99",'
    replacement = '''# EasyJob CPU startup: avoid a long empty inference before serving.
        cmd + ([] if os.environ.get("LLAMA_WARMUP", "false").lower() == "true" else ["--no-warmup"])
        + ["-t", os.environ.get("LLAMA_THREADS", "2"), "-tb", os.environ.get("LLAMA_THREADS", "2")]
        + ["-m", model, "--mmproj", mmproj, "-ngl", "99",'''
    if original not in source:
        raise ValueError('Unexpected Parlor llama command')
    return source.replace(original, replacement, 1)

BLOCKING = '''@asynccontextmanager
async def lifespan(app):
    await asyncio.get_event_loop().run_in_executor(None, load_models)
    yield
    llama.stop()
'''
LEGACY = '''@asynccontextmanager
async def lifespan(app):
    # Start model loading in the background so `/` and static assets are
    # available immediately on a fresh deployment.
    load_task = asyncio.create_task(asyncio.to_thread(load_models))
    yield
    if not load_task.done():
        load_task.cancel()
    llama.stop()
'''
LIFESPAN = '''# EasyJob: readiness follows completed model loading, not the HTML response.
@asynccontextmanager
async def lifespan(app):
    app.state.models_ready = False
    app.state.models_failed = False

    async def load():
        try:
            await asyncio.to_thread(load_models)
        except Exception as exc:
            app.state.models_failed = True
            import logging
            logging.getLogger("easyjob.parlor").error("Parlor model startup failed (%s)", type(exc).__name__)
        else:
            app.state.models_ready = True

    load_task = asyncio.create_task(load())
    try:
        yield
    finally:
        if not load_task.done():
            load_task.cancel()
        llama.stop()
'''
READY = '''app = FastAPI(lifespan=lifespan)
app.state.models_ready = False
app.state.models_failed = False


@app.get("/health/ready")
async def easyjob_readiness():
    from fastapi.responses import JSONResponse
    ready = app.state.models_ready
    status = "ready" if ready else "unavailable" if app.state.models_failed else "loading"
    return JSONResponse(status_code=200 if ready else 503, content={"status": status})
'''
WS = '''async def websocket_endpoint(ws: WebSocket):
    if not app.state.models_ready:
        await ws.close(code=1013, reason="Parlor models are not ready")
        return
    await ws.accept()'''


def patch(source: str) -> str:
    if '# EasyJob: readiness follows completed model loading' in source:
        return source
    previous = next((block for block in (BLOCKING, LEGACY) if block in source), None)
    if previous is None or 'app = FastAPI(lifespan=lifespan)' not in source or 'async def websocket_endpoint(ws: WebSocket):\n    await ws.accept()' not in source:
        raise ValueError('Unexpected Parlor source; review the pinned upstream revision')
    return (source.replace(previous, LIFESPAN, 1)
            .replace('app = FastAPI(lifespan=lifespan)', READY.rstrip(), 1)
            .replace('async def websocket_endpoint(ws: WebSocket):\n    await ws.accept()', WS, 1))


if __name__ == '__main__':
    llama = sys.argv[1] == '--llama'
    target = Path(sys.argv[2] if llama else sys.argv[1])
    target.write_text((patch_llama if llama else patch)(target.read_text()), encoding='utf-8')
