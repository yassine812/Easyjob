# Parlor live interview practice

EasyJob can open [Parlor](https://github.com/fikrikarim/parlor) inside the Interview Coach preparation step. Parlor is an Apache-2.0, self-hosted voice and vision assistant: after permission, the browser sends microphone/camera frames to the configured Parlor server, which returns live transcript and spoken replies. With VPS deployment, that processing happens on the VPS. The regular EasyJob interview coach remains available as the scored, persisted workflow.

## Unified deployment

The production compose stack builds and starts Parlor together with the API, frontend, database, worker, AI service and Caddy. Set `PARLOR_DOMAIN` and `NEXT_PUBLIC_PARLOR_URL` in `.env.staging`, create DNS for both domains, then run the existing one-command deployment:

```bash
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging up -d --build
```

The image uses the pinned prebuilt `llama-server` release, so the first build does not compile `llama.cpp`. The first container start downloads the selected model into the `parlor_models` volume. The default `PARLOR_MODEL=e2b` is the smaller model. The Parlor web UI is available while that first download runs; live WebSocket practice becomes active as soon as the model finishes loading. A Linux VPS with enough RAM is still required; a GPU improves latency but is not required by this CPU image. Both `app-staging.example.com` and `parlor-staging.example.com` must point to the same server so Caddy can issue certificates and the browser can use the microphone/camera securely.

## Local setup

Parlor upstream targets Python 3.12 and supported macOS Apple Silicon or Linux runtimes. On Windows, use WSL2 with a supported runtime; native Windows is not promised by the upstream project.

From the EasyJob repository root:

```powershell
npm run parlor:setup
npm run parlor:start
```

The first start may download several gigabytes of model and TTS assets. When the sidecar is ready, open EasyJob's Candidate → Interview Coach, prepare a session, and click **Open Parlor practice**. The panel uses `http://localhost:8001` by default and requests camera/microphone permission only after the user opens it. Port 8000 is reserved for the separate EasyJob AI service.

To use another host or port, set this public frontend variable before starting Next:

```env
NEXT_PUBLIC_PARLOR_URL=http://127.0.0.1:8001
```

Parlor is optional. If it is stopped or not installed, EasyJob's normal microphone/camera interview flow continues to work. No Parlor API key is required for its fully local mode; the optional upstream research reasoner is separate and remains disabled unless configured.

## Readiness and resources

`/health/ready` returns 200 only after the language, turn-detection and speech models load; it returns 503 while loading or after a loading failure. The WebSocket refuses practice sessions until that readiness check succeeds. An accessible HTML page alone does not prove inference works.

The 2026-10-30 Windows validation machine has 6 GB of physical RAM and could not load the real Gemma pipeline alongside EasyJob under Docker/WSL. The engine logged insufficient system memory even with reduced context. The adapter's six lifecycle/CPU tests passed; real Parlor inference on that machine did not. Size the VPS using measured model memory, then verify readiness and an actual spoken response. `PARLOR_CONTEXT_SIZE`, `PARLOR_THREADS` and `PARLOR_WARMUP` control CPU startup; reducing context cannot compensate for insufficient memory for the model weights.
