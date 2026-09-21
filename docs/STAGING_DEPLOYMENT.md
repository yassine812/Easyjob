# Startup Starter — Staging Deployment Runbook

This runbook deploys the full stack (PostgreSQL, Redis, NestJS API, BullMQ worker,
FastAPI AI, Next.js frontend, Caddy reverse proxy) to a VPS with Docker Compose.
It was verified end-to-end locally against the production compose file
(`docker-compose.prod.yml`) with the same images and flows the VPS will run.

---

## 1. Architecture

```
Internet ── 80/443 ── Caddy (reverse proxy, TLS)
                       │
                       ├── /            → web:3000        (Next.js, standalone)
                       ├── /api/*       → api:3000        (NestJS REST)
                       ├── /socket.io/* → api:3000        (Socket.IO + WebSocket upgrade)
                       └── /docs*       → api:3000        (Swagger)

Internal network (not exposed publicly): postgres:5432, redis:6379, ai:8000, mailpit:8025
```

Only Caddy (80/443) is public. PostgreSQL, Redis, the AI service and Mailpit are
never exposed to the internet. The API port 3000 is bound to `127.0.0.1` only
(for local debugging/health checks).

Services (from `docker-compose.prod.yml`):

| Service   | Image/source                    | Purpose                                      |
|-----------|---------------------------------|----------------------------------------------|
| postgres  | postgres:16-alpine              | Primary database (persistent volume)         |
| redis     | redis:7-alpine                  | BullMQ + realtime pub/sub + caching (appendonly) |
| api       | ./Dockerfile                    | NestJS REST API (runs `prisma migrate deploy`) |
| worker    | ./Dockerfile                    | BullMQ consumers (email, notifications, AI, CV, analytics, automation) |
| ai        | ./ai-service/Dockerfile         | FastAPI AI service (internal only)           |
| web       | ./web/Dockerfile                | Next.js standalone server                    |
| caddy     | caddy:2-alpine                  | TLS reverse proxy (Let's Encrypt or internal CA) |
| mailpit   | axllent/mailpit                 | Staging SMTP catcher + web UI (:8025)        |

---

## 2. Server prerequisites

- Docker Engine 24+ with Docker Compose v2
- A domain with an A record pointing to the server IP (e.g. `app-staging.example.com`)

## 3. Files to copy

```bash
scp docker-compose.prod.yml user@server:/opt/startup-starter/
scp -r deploy user@server:/opt/startup-starter/
# source code (for image builds): backend repo + web/ + ai-service/
```

## 4. Environment configuration

Copy the template and fill in real values (never commit secrets):

```bash
cp .env.staging.example .env.staging
# edit .env.staging — set STAGING_DOMAIN, DATABASE password, JWT secrets,
# S3/SMTP/Stripe/OpenAI credentials, and NEXT_PUBLIC_* URLs for the real domain.
```

Key production variables:

| Variable | Notes |
|----------|-------|
| `STAGING_DOMAIN` | e.g. `app-staging.example.com` — must resolve to the server |
| `CADDY_CONFIG` | `./deploy/Caddyfile.prod` for automatic Let's Encrypt on the public domain |
| `NEXT_PUBLIC_API_URL` | `https://app-staging.example.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `https://app-staging.example.com` |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://app-staging.example.com` |
| `FRONTEND_URL` | same as `NEXT_PUBLIC_FRONTEND_URL` (used by the API for links/cookies) |
| `CORS_ORIGINS` | the frontend origin(s), comma-separated |
| `COOKIE_SECURE` | `true` once behind HTTPS |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 random bytes each |
| `AI_API_KEY` | shared secret — set on both `ai` and `api`/`worker` (already wired) |
| `STORAGE_SIGNING_SECRET` | used to sign private file URLs |
| `PAYMENT_PROVIDER` | `stripe` (or `dev` for local testing) |
| `SMTP_HOST/PORT/USER/PASS` | real SMTP for staging email |

Generate strong secrets:

```bash
openssl rand -hex 32   # repeat for each secret
```

## 5. Deploy

```bash
cd /opt/startup-starter
export $(grep -v '^#' .env.staging | xargs)   # or use --env-file below

# Build images (first deploy; ~5-10 min)
docker compose -f docker-compose.prod.yml --env-file .env.staging build

# Start everything (PostgreSQL + Redis must be healthy first)
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d

# Check health
docker compose -f docker-compose.prod.yml --env-file .env.staging ps
curl -s https://app-staging.example.com/api/v1/health
# → {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}},...}
```

Migrations run automatically on API/worker start (`npx prisma migrate deploy`).
Never use `prisma migrate dev` on staging/production.

### Seeding staging data (optional, dev/test only)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.staging \
  run --rm api node dist/prisma/prisma/seed.js
```

Seeded credentials (fake data only): platform admin `admin@startupstarter.test`,
company admins `aadmin@startupstarter.test`, `badmin@startupstarter.test`,
`cadmin@startupstarter.test`, candidates `alex@startupstarter.test` etc., all with
password `Password123!`. Do not seed on a production environment with real users.

## 6. TLS / HTTPS

- **Local simulation**: `CADDY_CONFIG=./deploy/Caddyfile` + `CADDY_TLS=internal`
  (self-signed, used for the local verification of this runbook).
- **Public VPS**: `CADDY_CONFIG=./deploy/Caddyfile.prod` — Caddy requests a Let's
  Encrypt certificate automatically for `STAGING_DOMAIN` (no TLS block in the
  file, so `tls` defaults to automatic). Open ports 80 and 443 in the firewall.

Both Caddyfiles set `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`
and `Permissions-Policy`.

## 7. Backups

Automated daily backup (cron on the host):

```cron
0 3 * * * docker exec $(docker ps -qf name=postgres) pg_dump -U postgres -d startup_starter -Fc -f /backups/startup_starter_$(date +\%F).dump && find /backups -name '*.dump' -mtime +14 -delete
```

Restore (tested in this runbook — dump → restore → row counts matched):

```bash
docker exec <postgres-container> psql -U postgres -c "CREATE DATABASE restore_test;"
docker exec <postgres-container> pg_restore -U postgres -d restore_test --no-owner /backups/startup_starter_YYYY-MM-DD.dump
```

- Retention: keep 14 daily dumps; store the `/backups` mount off-box (S3/rsync).
- The compose volume is `postgres_data`; the full filesystem snapshot of that
  volume is the fallback restore path.

## 8. Monitoring & health

- `GET /api/v1/health` → reports database + Redis status.
- Container healthchecks: postgres, redis, ai (`/health`), mailpit. API/worker/web
  rely on the health endpoint and `restart: unless-stopped`.
- Logs: `docker compose logs -f api worker ai web`.
- Structured API logs include `requestId`, `method`, `url`, `status`, `durationMs`.

Verified behavior: if the worker restarts mid-queue, BullMQ re-processes the
unacked job (retries with exponential backoff); the API reconnects to PostgreSQL
and Redis automatically.

## 9. Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.staging build api worker ai web
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d
```

If a new Prisma migration was added, the API/worker boot runs `migrate deploy`
automatically.

## 10. Known verified flows (this runbook was exercised against the compose stack)

- Register → Mailpit verification email → login (httpOnly refresh cookie) →
  refresh → logout
- CV upload → BullMQ → FastAPI extraction → AI analysis (COMPLETED, real PDF)
- Apply → duplicate application rejected (400) → company pipeline move →
  `application.updated` + `notification.created` over Socket.IO
- Billing: dev checkout → webhook delivered twice → exactly 1 payment,
  subscription ACTIVE; wrong signature → 401
- Backup → restore → identical row counts
- Tenant isolation: company A ↔ B application/job/CV access returns 403/404
