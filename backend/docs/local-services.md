# Reliable local development services (Windows)

`http://localhost:3000` is the Next development frontend; its configured API is on port 3002 and its local face service on 8000. The Docker production-simulation API on IPv4 port 3000 is a separate stack and must not be used as a replacement API for this development database.

Previously `npm run dev` in `web` started only Next. Separate API/Python processes could disappear while the frontend continued serving the login screen. This produced the same face-unavailable message as a failed AI request. On 25 September both local ports refused connections, while the frontend remained running.

## Start

Run `npm run dev` in `web`, or `npm run dev:api` at the repository root. Both now ensure the local API and face models are ready and start a single background supervisor. The supervisor checks every 15 seconds, with bounded backoff after failed recovery. It uses the existing project startup scripts and stored database volumes. Concurrent starts share the same supervisor on loopback port 3019; an unrelated listener is not overwritten.

Readiness requires `/api/v1/health` and `/health/face`. The latter loads the bundled detector and embedding models and runs a synthetic inference, without camera data. Failed readiness returns 503, including when basic `/health` is still healthy. Shared embedding inference is protected against concurrent DNN input changes.

The supervisor restarts missing processes; it does not kill an unrelated port owner or change authentication thresholds. A listening but unhealthy service/configuration failure remains an actionable startup error rather than triggering indiscriminate process termination. Docker Desktop must be running. No Windows startup task or cloud automation is installed.

## Maintenance

Before intentionally stopping services for migrations/rebuilds, run `node scripts/local-services.cjs --stop`. This stops supervision only. Existing API and AI processes are left intact. Restart with `node scripts/local-services.cjs` after maintenance.

Logs: `.runtime/local-services.log` (supervision), `.runtime/local-services-recovery.log` (startup), `.runtime/ai.error.log` and `.runtime/api-recovery.error.log`. No camera frames, embeddings or credentials are logged by supervision. The frontend distinguishes an unreachable API from an unavailable face processor.

## Verification (25 September 2026)

- Forced termination of the verified local API and Python processes: both were automatically replaced with new PIDs and became ready without manual restart.
- Authenticated Nest FaceClient request to the restarted Python service processed a public-domain test portrait successfully. No user's camera images or embeddings were logged.
- Face readiness/pipeline tests pass, including different-identity rejection, still-image replay rejection and blurred-image handling. The frontend face-login suite passes 23 tests. The supervisor probe test rejects non-200, starting, malformed-health and unreachable services.
- No biometric thresholds or authentication acceptance rules were relaxed.
