# Preview run doc — Startup Starter web frontend

The frontend lives in `web/` (Next.js 16 App Router, Tailwind, shadcn/ui).

## Reproduce the artifacts a fresh checkout needs

1. Install dependencies (from `web/`):
   ```
   cd web && npm ci
   ```
   (`node_modules` and `package-lock.json` are the sources of truth; do not use pnpm/yarn.)

2. Environment file — `web/.env.local` is gitignored and must be copied from the main checkout
   (it already exists there; values never contain secrets, only public URLs):
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
   NEXT_PUBLIC_WS_URL=http://localhost:3000
   NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
   ```
   These point at the local/staging NestJS API, which serves the REST API on
   `http://localhost:3000/api/v1` and Socket.IO on `http://localhost:3000`.

3. The API must be reachable at `http://localhost:3000` before the app is useful
   (either the local dev backend or the staging Docker api container mapped to
   `127.0.0.1:3000`). Health check: `curl http://localhost:3000/api/v1/health`.

## How to run the server

Dev server (HMR, Turbopack). Note: port 3001 is normally taken by the staging
Docker web container, so run the preview on 3010:

```
cd web && npm run dev -- -p 3010
```

Detached on Windows (PowerShell), logging to separate files:

```
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','-p','3010' -WorkingDirectory 'C:\Users\Yassine\job startup\web' -RedirectStandardOutput 'C:\Users\Yassine\job startup\.freebuff\preview-f4b27e8f-a889-49dc-84cd-42bf24ea32cd.log' -RedirectStandardError 'C:\Users\Yassine\job startup\.freebuff\preview-f4b27e8f-a889-49dc-84cd-42bf24ea32cd.log.err' -WindowStyle Hidden -PassThru).Id"
```

Verify it answers: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/`

The staging production build is also reachable at `http://localhost:3001/` (Docker
`startup-starter-prod-web-1`, proxied by Caddy at `https://app-staging.local`).
