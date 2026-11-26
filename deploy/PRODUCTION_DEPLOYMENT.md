# EasyJob production deployment on one VPS

This runbook deploys the frontend, NestJS API, worker, PostgreSQL, Redis, AI service, Parlor practice service and Caddy from the same repository. The database and uploaded-file volumes are preserved across restarts and image rebuilds.

## 1. Prepare the VPS

Use a supported 64-bit Linux VPS (Ubuntu 22.04/24.04 or Debian 12), at least 4 vCPU and 8 GB RAM for the full stack. Install Docker Engine and the Docker Compose v2 plugin. Open TCP ports 80 and 443 in the VPS firewall/security group.

Create DNS `A` records pointing to the VPS:

- `app.example.com` for the EasyJob web/API domain
- `parlor.example.com` for the interview practice service

Do not expose PostgreSQL, Redis, AI or Parlor ports publicly. The production compose file keeps them on the internal Docker network.

## 2. Clone and configure

```bash
sudo mkdir -p /opt/easyjob
sudo chown "$USER":"$USER" /opt/easyjob
git clone https://github.com/yassine812/Easyjob.git /opt/easyjob
cd /opt/easyjob
cp backend/.env.staging.example backend/.env.staging
${EDITOR:-nano} backend/.env.staging
```

Set real values before starting anything:

- `STAGING_DOMAIN`, `PARLOR_DOMAIN`, `FRONTEND_URL`, `NEXT_PUBLIC_*` URLs (all `https://`)
- generated `POSTGRES_PASSWORD`, JWT secrets, `AI_API_KEY`, and `STORAGE_SIGNING_SECRET`
- S3-compatible storage credentials (or change the storage provider only if the backend configuration supports it)
- SMTP host/user/password and sender address
- Stripe test/live credentials and price IDs, or the configured Konnect credentials
- `OPENAI_API_KEY` when `AI_PROVIDER=openai`

Never commit `backend/.env.staging` or paste it into issue trackers. The template contains placeholders and is intentionally rejected by the preflight check.

## 3. Validate before changing running services

Run these commands from the repository root:

```bash
node backend/scripts/preflight-deploy.cjs --env-file backend/.env.staging
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging config --quiet
```

The first command blocks missing secrets, example domains, insecure cookies, HTTP URLs, invalid CORS/API relationships, development payments, and incomplete SMTP/S3/Stripe settings. Fix every error before continuing.

## 4. Deploy the core stack

```bash
docker compose -f backend/docker-compose.prod.yml \
  --env-file backend/.env.staging \
  up -d --build
```

The API and worker run `prisma migrate deploy` before starting, so migrations are applied against the existing database. This command does not remove volumes. The first AI image build downloads and embeds the multilingual interview model, verified face models and pinned multilingual Whisper-small model; allow extra time and disk space on the first build. Later builds reuse Docker layers.

The supplied production templates set `COMPOSE_PROFILES=jobops,mirofish`, so those sidecars are started by the normal command above. MiroFish falls back to the local recruiter simulation until `MIROFISH_SIMULATION_ID` points to a prepared simulation. The public job catalog remains `JOB_CATALOG_MODE=PLATFORM_ONLY` and external imports, including JobOps, are disabled: only companies registered in EasyJob supply its public offers.

If you intentionally need to disable the sidecars for a smaller VPS, set `COMPOSE_PROFILES=` and the two feature flags to `false` in the environment file. To explicitly start them without relying on the environment file:

```bash
docker compose -f backend/docker-compose.prod.yml \
  --env-file backend/.env.staging \
  --profile jobops --profile mirofish \
  up -d --build
```

JobOps needs its sidecar URL and search configuration. MiroFish needs a prepared simulation/agent and provider credentials for external swarm responses; its local fallback keeps interview preparation available while those are being configured.

## 5. Create the one platform administrator

The public registration flow cannot create an administrator. After the first API start, seed the system roles once and create the initial administrator from inside the API container. Use a strong password and do not put it in shell history:

```bash
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging \
  exec -T api node dist/prisma/prisma/seed-system.js

read -r -s ADMIN_PASSWORD
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging \
  exec -T -e PLATFORM_ADMIN_EMAIL=admin@example.com \
  -e PLATFORM_ADMIN_NAME='EasyJob Platform Admin' \
  -e PLATFORM_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  api node scripts/create-platform-admin.cjs
unset ADMIN_PASSWORD
```

The command is one-time and refuses to create a second platform administrator. If the account already exists, use the server-only grant command after verifying the account owner:

```bash
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging \
  exec -T api node scripts/bootstrap-admin.cjs admin@example.com --role=PLATFORM_ADMIN
```

## 6. Verify the deployment

```bash
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging ps
curl -fS https://app.example.com/health
curl -fS https://app.example.com/api/v1/health
curl -fS https://parlor.example.com/health/ready
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging \
  logs --tail=100 api worker ai web parlor caddy
```

All core containers should be `healthy` or `running`. A running Parlor process is insufficient: require `/health/ready` to return 200 and verify a real spoken response. See [Parlor resource observations](parlor/README.md#readiness-and-resources). Test one login, a job search, CV upload, interview practice, and an email/password reset from a real browser. Check the browser console and the API logs if a workflow fails; do not expose internal service ports to “fix” a browser error.

For Konnect, set `KONNECT_ENABLED=true`, the merchant API key and receiving wallet, and `KONNECT_WEBHOOK_URL=https://app.example.com/api/v1/payments/webhook/konnect`. Select sandbox/live explicitly. The deployment preflight rejects incomplete credentials and callbacks pointing to another route. Unit tests verify the adapter, but a real sandbox checkout and authoritative callback verification are required before claiming the merchant integration is active. No merchant credentials are supplied by the repository.

## 7. Backups and safe updates

Before updates, take a database dump and confirm S3/object-storage versioning or a separate backup exists:

```bash
mkdir -p /opt/easyjob/backups
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging \
  exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/opt/easyjob/backups/easyjob-$(date +%F-%H%M).sql.gz"
git pull --ff-only
node backend/scripts/preflight-deploy.cjs --env-file backend/.env.staging
docker compose -f backend/docker-compose.prod.yml --env-file backend/.env.staging up -d --build
```

For rollback, check out the previous known-good commit and run the same compose command. Never run `docker compose down -v` in production: `-v` deletes the database and Redis volumes. Keep at least one previous image/commit until the smoke tests pass.

## Availability note

Compose rebuilds replace the changed containers, so a normal `up -d --build` can cause a short restart while the new image is activated. It preserves data and restarts exited containers according to their restart policy; a failing healthcheck alone does not restart a container. This is not zero-downtime deployment. If uninterrupted service is required, run two copies (blue/green) behind an external load balancer and switch traffic only after the new stack passes the health checks.

