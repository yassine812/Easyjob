# Startup Starter — Beta Launch Checklist

Use this to gate the controlled beta. Everything local that can be verified is
already green (unit 49, E2E 59, AI 12, frontend 42, lint/typecheck/builds).

## Infrastructure

- [ ] **Domain**: `YOUR_DOMAIN.com` registered and owned
- [ ] **VPS**: 2 vCPU / 4 GB RAM, Ubuntu 22.04+, Docker ≥ 24 installed
- [ ] **DNS**: A record(s) for `YOUR_DOMAIN.com` (+ `www`, optional `api.`) point at the VPS; `dig` resolves
- [ ] **Firewall**: only 22/80/443 open; 5432/6379/8000/3000/3001 never public
- [ ] **HTTPS**: Caddy serves Let's Encrypt certs; `curl -sI https://YOUR_DOMAIN.com` shows HSTS
- [ ] **`.env.production`**: every MANDATORY var filled from `.env.production.example`; file not committed
- [ ] **Deploy**: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d` → all services `Up (healthy)`
- [ ] **Health**: `GET https://YOUR_DOMAIN.com/api/v1/health` → database/redis/ai all `up`

## External services

- [ ] **PostgreSQL**: migrations applied via `prisma migrate deploy` on boot (verify table count)
- [ ] **Redis**: reachable from api + worker; `docker compose exec redis redis-cli ping` → PONG
- [ ] **Storage (S3)**: private bucket + IAM keys in env; CV upload → private object → signed URL works, unexpired
- [ ] **SMTP**: real provider configured; verification/reset/application/interview emails actually arrive (not Mailpit)
- [ ] **Stripe (TEST MODE)**: products + prices created; `sk_test_*` + `whsec_*` in env; webhook endpoint registered → `https://YOUR_DOMAIN.com/api/v1/billing/webhook`; test checkout → webhook → subscription ACTIVE; duplicate webhook → single payment
- [ ] **AI**: `AI_API_KEY` identical on ai/api/worker; `rule_based` works; `openai` works if key set; AI failure doesn't break core flows
- [ ] **Backups**: nightly cron installed; restore drill passed; `/backups` off-box copy
- [ ] **Monitoring**: health endpoint reachable; `docker compose ps` + logs reviewed; no sensitive data in logs

## Security

- [ ] HTTPS only + HSTS + secure cookies (`COOKIE_SECURE=true`)
- [ ] CORS restricted to the exact frontend origin
- [ ] Refresh token httpOnly; no tokens in localStorage
- [ ] Stripe webhook signature verification on
- [ ] AI service not publicly reachable (Bearer auth + internal network)
- [ ] Face login validated in staging before `BIOMETRIC_ENABLED=true` (enroll, login, wrong-face rejection, disable, password fallback)
- [ ] `BIOMETRIC_ENCRYPTION_KEY` set on api+worker (64 hex), never in the frontend
- [ ] Biometric privacy review against Tunisian data-protection law (see `docs/PRIVACY.md`)
- [ ] CV bucket private; signed URLs short-lived
- [ ] No secrets in Git (`git ls-files | grep .env` → none)
- [ ] Tenant isolation spot-check: Company A vs Company B returns 403/404 on the live site

## Functional smoke (live, production stack)

### Candidate
- [ ] Register → verification email → verify → login
- [ ] Complete profile (skills, experience, education)
- [ ] Upload real CV → AI analysis COMPLETED with a score
- [ ] Search jobs → save job → apply → duplicate application rejected
- [ ] Application status change + interview → realtime notification received
- [ ] Signed CV download works for owner

### Company
- [ ] Register → create company → verification submitted
- [ ] Admin approves verification → company VERIFIED
- [ ] Post job → submit → admin approves → publish
- [ ] Candidate applies → notification + pipeline shows application
- [ ] Open candidate → authorized CV → add note → move status → schedule interview
- [ ] Invite HR (within plan limit) → invitation email
- [ ] Upgrade via Stripe test checkout → webhook → entitlement limit increases
- [ ] Analytics + audit log reflect activity

### Admin
- [ ] Login → manage users/companies/jobs/subscriptions
- [ ] Company verification workflow (approve/reject)
- [ ] Platform analytics + audit logs visible

## Post-launch guardrails

- [ ] Monitoring alerts on health-check failure
- [ ] Backup restore drill scheduled monthly
- [ ] Stripe live-mode switch plan documented (flip keys, re-map prices, keep webhooks)
