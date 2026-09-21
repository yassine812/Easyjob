# Startup Starter — Production VPS Deployment

This guide deploys the complete application to a fresh Linux VPS with a real
domain and HTTPS. It was validated against the production compose stack
(`docker-compose.prod.yml`); the local simulation walk-through is in
[`STAGING_DEPLOYMENT.md`](./STAGING_DEPLOYMENT.md).

## 1. Architecture

```
Internet
   │  HTTPS (443) only
   ▼
Caddy (Let's Encrypt TLS, reverse proxy, security headers)
   ├── /            → web:3000      (Next.js standalone)
   ├── /api/*       → api:3000      (NestJS REST + /docs Swagger)
   └── /socket.io/* → api:3000      (Socket.IO / WSS)
   │
   ├── api:3000 ──► postgres:5432   (private)
   │            ──► redis:6379      (private)
   │            ──► ai:8000         (private, Bearer-key auth)
   ├── worker (BullMQ consumers, private) ──► redis, postgres, ai, SMTP
   └── web:3000 (Next.js)

All internal services are on a private Docker network.
Only Caddy's 80/443 touch the public internet.
```

## 2. VPS requirements

- **Recommended**: 2 vCPU / 4 GB RAM (4 vCPU / 8 GB for heavier AI load), 40 GB SSD.
- **OS**: Ubuntu 22.04/24.04 LTS (or Debian 12).
- Docker Engine ≥ 24 + Docker Compose v2.
- A domain with an A record pointing at the VPS IP.
- Open ports **80** and **443** (firewall). Never open 5432/6379/8000/8025/3000/3001.

## 3. One-time server setup

```bash
# 1. Update the system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in afterwards

# 3. Firewall (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 4. Create the application directory and user
sudo mkdir -p /opt/startup-starter && sudo chown $USER:$USER /opt/startup-starter
cd /opt/startup-starter
```

## 4. DNS

| Type | Name | Value |
|------|------|-------|
| A | `YOUR_DOMAIN.com` | VPS IP |
| A | `www.YOUR_DOMAIN.com` | VPS IP (optional) |
| A | `api.YOUR_DOMAIN.com` | VPS IP (only if you choose the API subdomain variant) |

Wait for propagation: `dig +short YOUR_DOMAIN.com`.

## 5. Upload the code and configuration

```bash
# From your machine
scp -r backend/ web/ ai-service/ deploy/ docker-compose.prod.yml \
  .env.production.example user@YOUR_SERVER:/opt/startup-starter/

# On the server — create the real env from the template (never commit it)
cd /opt/startup-starter
cp .env.production.example .env.production
nano .env.production        # fill every MANDATORY value (see comments)
```

### Environment summary (mandatory)

| Group | Mandatory variables |
|-------|---------------------|
| APP | `NODE_ENV=production`, `FRONTEND_URL`, `RUN_WORKERS` |
| DATABASE | `DATABASE_URL` (password you set for the compose postgres) |
| REDIS | `REDIS_URL` |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (two different `openssl rand -hex 64` values) |
| STORAGE | `STORAGE_PROVIDER=s3`, `S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY`, `STORAGE_SIGNING_SECRET` |
| SMTP | `EMAIL_PROVIDER=smtp`, `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` |
| AI | `AI_API_KEY` (same on ai/api/worker), `AI_SERVICE_URL=http://ai:8000`, `AI_PROVIDER` |
| STRIPE | `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MAP_*` |
| CORS/FRONTEND | `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_FRONTEND_URL` |
| SECURITY | `COOKIE_SECURE=true` |
| DEPLOY | `STAGING_DOMAIN`, `CADDY_CONFIG=./deploy/Caddyfile.prod` |

Generate secrets:

```bash
openssl rand -hex 64    # repeat for JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
                        # STORAGE_SIGNING_SECRET, AI_API_KEY, DB password
```

## 6. Deploy

```bash
cd /opt/startup-starter

# Build images (first deploy ~5–10 min)
docker compose -f docker-compose.prod.yml --env-file .env.production build

# Start everything
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Check health
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -s https://YOUR_DOMAIN.com/api/v1/health
# → {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"},"ai":{"status":"up"}}}
```

Migrations run **automatically** on API/worker boot with `prisma migrate deploy`.
**Never run `prisma migrate dev` or reset the database on production.**

### Domain variants

- **Single domain (recommended for beta)**: set
  `STAGING_DOMAIN=YOUR_DOMAIN.com` and all `NEXT_PUBLIC_*` URLs to
  `https://YOUR_DOMAIN.com`. Frontend, API and WebSocket share one origin —
  cookies just work.
- **With www**: set `STAGING_DOMAIN=YOUR_DOMAIN.com, www.YOUR_DOMAIN.com`
  (Caddy provisions certs for both).
- **API subdomain** (optional): add an `api.YOUR_DOMAIN.com` site block in
  `deploy/Caddyfile.prod` proxying `/api/*`, `/docs*`, `/socket.io/*`; set
  `NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN.com/api/v1`,
  `NEXT_PUBLIC_WS_URL=https://api.YOUR_DOMAIN.com`,
  `CORS_ORIGINS=https://YOUR_DOMAIN.com`, and
  `COOKIE_DOMAIN=.YOUR_DOMAIN.com` so the refresh cookie is shared.

## 7. Storage (S3)

1. Create a private bucket (e.g. `startup-starter-prod`) — **no public access**.
2. Create an IAM user with a policy allowing only `s3:PutObject`,
   `s3:GetObject`, `s3:DeleteObject` on that bucket.
3. Put credentials in `.env.production` (`S3_*`).
4. Verify: upload a CV from the app → it is private → the signed URL works for
   the owner and the authorized company → 403 for everyone else and expired URLs.

All CVs/documents are stored private; downloads use short-lived signed URLs.
Never create a public bucket or public-read objects.

## 8. Email (SMTP)

Use a real transactional provider (Resend, Postmark, Mailgun, SES, or your
provider's SMTP). Put `SMTP_*` in `.env.production`; `EMAIL_PROVIDER=smtp`.

Verify after deploy:
- registration → verification email
- password reset → reset email
- application submitted → company notification
- application status change → candidate notification
- interview scheduled → candidate notification

**Mailpit (`dev-smtp`) is staging-only and must not be used in production.**

## 9. Stripe (keep TEST MODE for beta)

1. In the Stripe dashboard (test mode) create products + prices for:
   Candidate Pro (monthly/yearly), Company Business, Company Pro, Enterprise.
2. Put the test secret key in `STRIPE_SECRET_KEY` and map prices with
   `STRIPE_PRICE_MAP_*`.
3. Create a webhook endpoint → `https://YOUR_DOMAIN.com/api/v1/billing/webhook`
   subscribed to at least:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
5. The webhook is **authoritative**: subscription activation only happens from
   verified webhook events (signature-checked, deduplicated via the
   `ProcessedWebhookEvent` ledger). The frontend `?success=true` redirect is
   never trusted as proof of payment.

To switch to live later: repeat with live keys/prices and flip `sk_test_`→`sk_live_`.
The app does not need code changes.

## 10. AI

- `AI_PROVIDER=rule_based` → zero-cost heuristic analysis (works with no keys).
- `AI_PROVIDER=openai` + `OPENAI_API_KEY` → real LLM analysis.
- The AI service is internal (`ai:8000`), requires `Authorization: Bearer
  <AI_API_KEY>`, and rejects browser origins. AI processing is asynchronous
  (BullMQ → FastAPI → result stored in `AiAnalysis`); a failure marks the
  analysis FAILED and never blocks CV upload, applications, or dashboards.

## 11. Backups

See [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md) for the exact commands and the
tested restore procedure. Recommended: nightly `pg_dump -Fc`, 14-day retention,
off-box copy (S3/rsync), plus a monthly restore drill.

## 12. Monitoring

- `GET /api/v1/health` → database, Redis and AI status.
- `docker compose -f docker-compose.prod.yml --env-file .env.production ps`
  → per-container status (postgres/redis/ai have healthchecks).
- Logs: `docker compose logs -f api worker ai web caddy`.
- Container healthchecks + `restart: unless-stopped` cover crash restarts;
  BullMQ re-processes unacked jobs after a worker restart.

## 13. Update / restart / rollback

```bash
# Update
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build api worker ai web
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Restart one service
docker compose -f docker-compose.prod.yml --env-file .env.production restart api

# Rollback (previous image tag, e.g. api:2026-08-14)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build api
```

Before any deploy that includes a Prisma migration, take a backup (schema
migrations are additive by convention, but a backup makes any rollback safe).

## 14. Seeding

The seed creates demo companies/candidates/applications and **refuses to run
when `NODE_ENV=production`** unless `SEED_FORCE=true`. Never run it on a
production database. In isolated demo environments only:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm api node dist/prisma/prisma/seed.js
```
