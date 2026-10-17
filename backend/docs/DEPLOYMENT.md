# Startup Starter — Production Deployment

This document describes how to deploy Startup Starter to a production VPS with
Docker Compose. It is the canonical deployment reference; the verified staging
walk-through lives in [`STAGING_DEPLOYMENT.md`](./STAGING_DEPLOYMENT.md).

Everything here was exercised against the production compose stack
(`docker-compose.prod.yml`) — same images, same flows.

---

## 1. Architecture

```
Internet ── 80/443 ── Caddy (reverse proxy, automatic TLS)
                       │
                       ├── /            → web:3000        (Next.js standalone)
                       ├── /api/*       → api:3000        (NestJS REST + Swagger /docs)
                       └── /socket.io/* → api:3000        (Socket.IO, WebSocket upgrade)

Internal-only (never exposed publicly):
  postgres:5432  redis:6379  ai:8000  mailpit:8025 (staging only)
```

| Service | Source | Purpose |
|---------|--------|---------|
| postgres | postgres:16-alpine | Primary DB, persistent volume `postgres_data` |
| redis | redis:7-alpine | BullMQ, realtime pub/sub, appendonly persistence |
| api | ./Dockerfile | NestJS API — runs `prisma migrate deploy` on boot |
| worker | ./Dockerfile | BullMQ consumers (email, notifications, AI, CV, analytics, automation) |
| ai | ./ai-service/Dockerfile | FastAPI AI service — backend-to-backend only |
| web | ./web/Dockerfile | Next.js standalone server (`output: "standalone"`) |
| caddy | caddy:2-alpine | TLS reverse proxy |

## 2. VPS requirements

- Docker Engine ≥ 24 + Compose v2
- 2 vCPU / 4 GB RAM minimum (4 vCPU / 8 GB recommended for the AI pipeline)
- Domain with an A record to the server IP (e.g. `app.example.com`)
- Open ports: **80**, **443** only. Never expose 5432/6379/8000/8025.

## 3. Required environment variables

Full template: `.env.staging.example` (copy to `.env.staging`; **never commit
secrets**). Generate secrets with `openssl rand -hex 32`.

| Variable | Required | Notes |
|----------|----------|-------|
| `STAGING_DOMAIN` | yes | public domain, must resolve to the server |
| `CADDY_CONFIG` | yes | `./deploy/Caddyfile.prod` for Let's Encrypt |
| `DATABASE_URL` | yes | `postgresql://user:pass@postgres:5432/startup_starter` |
| `REDIS_URL` | yes | `redis://redis:6379` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes | ≥ 32 random bytes each |
| `AI_API_KEY` | yes | shared secret, set on **both** `ai` and `api`/`worker` |
| `OPENAI_API_KEY` | yes* | real AI provider; `AI_PROVIDER=rule_based` works without it |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | yes | S3-compatible object storage |
| `STORAGE_SIGNING_SECRET` | yes | HMAC secret for signed private-file URLs (local provider) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | yes | transactional email (Mailpit on staging) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | yes | Stripe test/live pricing; `PAYMENT_PROVIDER=stripe` |
| `FRONTEND_URL` / `NEXT_PUBLIC_FRONTEND_URL` | yes | `https://app.example.com` |
| `NEXT_PUBLIC_API_URL` | yes | `https://app.example.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | yes | `https://app.example.com` (Socket.IO same origin) |
| `CORS_ORIGINS` | yes | comma-separated frontend origins |
| `COOKIE_SECURE` | yes | `true` in production (Secure cookies over HTTPS) |
| `NODE_ENV` | yes | `production` |

Do not invent variables the code does not use — the list above is the complete
set read by `src/config/configuration.ts`, `docker-compose.prod.yml` and
`web/.env.local`.

## 4. Deploy

```bash
cd /opt/startup-starter
cp .env.staging.example .env.staging && nano .env.staging   # fill secrets

docker compose -f docker-compose.prod.yml --env-file .env.staging build
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d

docker compose -f docker-compose.prod.yml --env-file .env.staging ps   # all healthy
curl -s https://app.example.com/api/v1/health
```

Migrations run automatically on API/worker boot (`npx prisma migrate deploy`).
**Never use `prisma migrate dev` in production.**

## 5. Database

- Persistent volume `postgres_data`; Redis `appendonly yes`.
- Verify constraints after deploy:
  ```sql
  -- webhook idempotency ledger
  SELECT * FROM "ProcessedWebhookEvent";            -- @@unique(provider, eventId)
  -- duplicate applications
  SELECT * FROM "Application";                      -- @@unique(jobId, candidateId)
  ```

### Backup

```bash
docker exec <postgres-container> pg_dump -U postgres -d startup_starter -Fc -f /backups/startup_starter_$(date +%F).dump
```

Cron (host): daily at 03:00, retain 14 dumps, copy `/backups` off-box.

### Restore (tested)

```bash
docker exec <postgres-container> psql -U postgres -c "CREATE DATABASE restore_test;"
docker exec <postgres-container> pg_restore -U postgres -d restore_test --no-owner /backups/startup_starter_YYYY-MM-DD.dump
# verify row counts match, then drop restore_test
```

## 6. TLS / HTTPS / DNS

- DNS: A record `app.example.com → <server-ip>` (and `www` if used).
- `deploy/Caddyfile.prod` enables automatic Let's Encrypt — Caddy obtains and
  renews certificates for `STAGING_DOMAIN` (no manual cert management).
- `deploy/Caddyfile` (internal CA) is for local simulation only.
- Security headers set by Caddy: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`; HSTS is handled by `COOKIE_SECURE`
  plus Caddy's HTTPS redirect.

## 7. Storage (S3)

- `STORAGE_PROVIDER=s3` uses `@aws-sdk` against any S3-compatible endpoint
  (`S3_ENDPOINT` supports MinIO/Wasabi/etc.).
- All objects are private; downloads use short-lived presigned URLs.
- `STORAGE_PROVIDER=local` (default in dev/staging) stores under the `storage_data`
  volume and serves through `/api/v1/files/signed` with HMAC validation.
- Candidates can only download their own CVs; companies only a candidate's CV
  after that candidate applied to one of their jobs; every download is
  audit-logged (`cv.download`).

## 8. Email (SMTP)

- Set `EMAIL_PROVIDER=smtp` with real `SMTP_*` credentials.
- All transactional emails go through the BullMQ email queue with `dedupeKey`
  (verification, password reset, application submitted, status changed,
  interview scheduled, company verification, team invitation, billing).
- Staging uses Mailpit (`EMAIL_PROVIDER=dev-smtp`, UI at `:8025`) — never in prod.

## 9. AI service

- FastAPI, internal only. The NestJS worker calls it with `Authorization: Bearer
  <AI_API_KEY>` (the key must be set on `ai`, `api` and `worker`).
- `AI_PROVIDER=openai` uses `OPENAI_API_KEY`; `rule_based` is the no-cost fallback
  used by tests and local staging.
- Health: `GET /health` (no auth) — used by the container healthcheck and the
  API's `/api/v1/health` info block.

## 10. Billing (Stripe)

- `PAYMENT_PROVIDER=stripe`; create prices in the Stripe dashboard and map them
  with `STRIPE_PRICE_<PLAN>_<INTERVAL>`.
- Checkout is initiated server-side; **webhooks are the source of truth** —
  a frontend `?success=true` redirect never activates a subscription.
- Webhook events are signature-verified and deduplicated via the
  `ProcessedWebhookEvent` ledger (`@@unique([provider, eventId])`), so Stripe
  retries never double-process.
- Point Stripe's webhook at `https://app.example.com/api/v1/billing/webhook`
  and set the signing secret in `STRIPE_WEBHOOK_SECRET`.

## 11. Worker

- `worker` is a separate container running the same image with a different
  command. BullMQ jobs have attempts/backoff; unacked jobs are re-processed after
  a worker restart (verified live).
- If the worker scales horizontally, keep the same Redis instance so queues and
  the realtime pub/sub bus are shared.

## 12. Health checks & logs

- `GET /api/v1/health` → `{ status, info: { database, redis, ai } }`.
- Container healthchecks: postgres, redis, ai, mailpit.
- `docker compose logs -f api worker ai web` — structured logs include
  `requestId`, `method`, `url`, `status`, `durationMs`.
- `restart: unless-stopped` on every service.

## 13. Restart & rollback

```bash
# restart a service
docker compose -f docker-compose.prod.yml --env-file .env.staging restart api

# update
git pull
docker compose -f docker-compose.prod.yml --env-file .env.staging build api worker ai web
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d

# rollback to the previous image tag
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d --no-build api
```

Before rolling forward with a schema change, take a DB backup (see §5); a
destructive migration can be rolled back by restoring that backup.

## 14. CI/CD

`.github/workflows/ci.yml` gates every push/PR on `main`/`master`:

- **backend**: lint → typecheck → unit → E2E (Postgres+Redis services) → build
- **ai**: lint + tests (rule-based provider)
- **frontend**: lint → typecheck → vitest → production build

Deployment must not be triggered manually before all three jobs are green
(e.g. a deploy job with `needs: [backend, ai, frontend]`).

## 15. Verified flows

- Register → email verify → login → httpOnly refresh cookie → refresh → logout
- Real-PDF CV: upload → BullMQ → FastAPI extraction → AI analysis COMPLETED
- Apply → duplicate rejection → company pipeline move → `application.updated` +
  `notification.created` over Socket.IO (exactly one event each)
- Billing: webhook delivered twice → exactly 1 payment; wrong signature → 401;
  entitlement limit → 403
- Tenant isolation: cross-company CV/application/job access → 403/404
- Backup → restore → identical row counts
