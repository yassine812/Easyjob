<<<<<<< HEAD
# Startup Starter — Backend

Multi-tenant recruitment SaaS backend built with **NestJS**, **TypeScript**, **PostgreSQL + Prisma**, **Redis + BullMQ**, **Socket.IO**, **S3-compatible storage** and a separate **FastAPI** AI service.

Candidates search and apply to jobs for free; companies manage verified profiles, jobs, pipelines, interviews and AI-powered recruitment; platform administrators moderate companies and jobs, manage users and inspect audit logs.

> Strict tenant isolation: Company A can never access Company B's candidates, jobs, applications, CVs, documents, analytics or team data. The tenant is always derived from the authenticated membership — never from request bodies or query parameters.

---

## Architecture

```
Frontend
   │  REST /api/v1 (+ WebSocket events)
   ▼
NestJS API (this repo)
   ├── Auth / RBAC (JWT access + rotating refresh tokens, bcrypt)
   ├── Tenant-scoped modules (companies, jobs, applications, interviews, …)
   ├── StorageService abstraction (S3 / MinIO / local) + signed URLs
   ├── Realtime gateway (Socket.IO, Redis pub/sub, room-per-tenant)
   └── BullMQ queues (email, notifications, AI, CV processing, analytics, automation)
          │
          ├── Workers (same codebase, separate process: npm run start:worker)
          │
          └── FastAPI AI service (ai-service/) → AI provider (rule-based / OpenAI)
```

- API process: `npm run start:prod` (`dist/main.js`)
- Worker process: `npm run start:worker` (`dist/worker-main.js`) — runs all BullMQ workers
- AI service: `uvicorn app.main:app` in `ai-service/` (see `ai-service/README.md`)

## Tech stack

| Concern      | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Framework    | NestJS 10, TypeScript (strict)                                |
| Database     | PostgreSQL 16, Prisma ORM (migrations + seed)                 |
| Cache/queue  | Redis 7, BullMQ 5                                             |
| Auth         | JWT access tokens (15 min) + rotating refresh tokens (30 d, stored hashed, httpOnly cookie or body) |
| Passwords    | bcrypt                                                        |
| Realtime     | Socket.IO gateway, Redis pub/sub, room-per-tenant             |
| Files        | StorageService abstraction → S3/MinIO/local, HMAC-signed local URLs, S3 presigned URLs |
| AI           | FastAPI service (`ai-service/`) with pluggable providers      |
| Payments     | Provider abstraction (`dev` provider for local; Stripe-ready) |
| Docs         | Swagger at `/docs` (non-production)                           |
| Observability| Structured JSON request logs with requestId, global exception filter, audit log table |

## Project layout

```
src/
├── main.ts / worker-main.ts / app.module.ts
├── config/            typed env configuration (CONFIG provider)
├── common/            guards, decorators, interceptors, filters, utils, constants
├── auth/  users/  roles/  admin/  audit/
├── companies/  company-members/  company-invitations/  company-verification/
├── candidates/        profiles, skills, experiences, education, resumes, saved jobs, preferences
├── files/             storage abstraction + validation
├── jobs/  search/  applications/  application-events/  interviews/
├── notifications/  realtime/  queues/email/
├── subscriptions/  plans(→subscriptions)  payments/  entitlements/
├── automation/  assessments/  analytics/  ai/  health/
ai-service/            FastAPI AI service (independent deployable)
prisma/                schema, migrations, seed
test/                  unit + e2e suites
```

## Prerequisites

- Node.js ≥ 18, npm
- Docker (PostgreSQL, Redis, MinIO, Mailpit via `docker-compose.yml`)
- Python ≥ 3.11 (only for the AI service)

## Local setup

### Windows: restore the local API for the Next.js frontend

With Docker Desktop running, execute `npm run dev:api` from the repository root.
This starts the project's PostgreSQL and Redis containers, launches the compiled
API on port **3002** in the background, and waits for its health check. It also
starts the local Python CV extractor on port **8000** and a dedicated CV queue
consumer, so uploaded CVs can actually finish processing. Python with the
`ai-service/requirements.txt` dependencies is required. An API
that is already healthy is reused. Startup logs are in
`.runtime/api-recovery.log` and `.runtime/api-recovery.error.log`.
After backend source changes, run `npm run build` before restarting the API.
Start the frontend separately with `npm run dev` from `web/` on port **3000**.
CV service logs are in `.runtime/ai.error.log` and `.runtime/cv-worker.log`.
Use `npm run dev:profiles` to restore only those profile services. Other worker
queues (email, notifications, analytics, automation) remain separate processes.

```bash
# 1. Infrastructure (PostgreSQL + Redis + MinIO + Mailpit)
docker compose up -d postgres redis minio mailpit

# 2. Environment
cp .env.example .env        # then adjust secrets/URLs

# 3. Install + database
npm install
npx prisma migrate dev      # apply migrations
npm run prisma:seed         # dev data (see Seed data)

# 4. Run the API (port from .env, default 3000)
npm run start:dev

# 5. Run the workers in a second terminal (email, notifications, AI, CV, analytics, automation)
npm run start:worker

# 6. AI service (optional for AI features)
cd ai-service
python -m pip install -r requirements.txt
AI_PROVIDER=rule_based uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:3000/docs** for Swagger.

### Web frontend (`web/`)

```bash
cd web
npm ci
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_FRONTEND_URL
npm run dev                         # http://localhost:3001 (or run on :3000 with -p)
```

The frontend is Next.js 16 (App Router) + React 19 + TypeScript + Tailwind +
shadcn/ui + TanStack Query + React Hook Form/Zod, with TypeScript API types
generated from the live backend OpenAPI (`/docs-json` via `openapi-typescript`).

> Local dev defaults: email provider `console` (emails are logged / captured), payment provider `dev`, storage provider `local`. `docker compose up` also starts Mailpit (host SMTP :2525, UI :8026) and MinIO (:9000/:9001) if you switch `EMAIL_PROVIDER=smtp` / `STORAGE_PROVIDER=s3`. For an API running directly on the host, set `SMTP_HOST=localhost` and `SMTP_PORT=2525`; containers use `mailpit:1025`.

## Running tests

```bash
# Unit tests (49) — no external services required
npm run test:unit

# E2E tests (59) — requires Postgres + Redis on localhost (e.g. the compose services)
npm run test:e2e            # uses startup_starter_test, applies migrations, runs full journey

# AI service tests (12)
cd ai-service && AI_PROVIDER=rule_based python -m pytest

# Quality gates
npm run lint                # ESLint (0 errors)
npm run typecheck           # tsc --noEmit
npx prisma validate
npm run build               # production build → dist/
```

## Authentication & RBAC

- `POST /api/v1/auth/register|login|logout|refresh|verify-email|resend-verification|forgot-password|reset-password`, `GET /api/v1/auth/me`
- Access tokens: signed JWT (`JWT_ACCESS_SECRET`). Refresh tokens: opaque, stored as SHA-256 hash, **rotated on every use** (old tokens die), revocable via logout.
- Roles: `PLATFORM_ADMIN`, `COMPANY_ADMIN`, `HR`, `RECRUITER`, `HIRING_MANAGER`, `INTERVIEWER`, `CANDIDATE`.
- Permission-based guards (`@Permissions(...)`, `@CompanyPermissions(...)`) evaluate **both** platform permissions and the tenant context (membership + company role) — a role grants the same permission in every company it belongs to, but tenant scoping is enforced per request via `CompanyAccessService`.
- **Optional face login** (`BIOMETRIC_ENABLED`, off by default): candidates and company users can enroll a face template (AES-256-GCM encrypted embedding — never a photo) and sign in with their face. Challenge-based, throttled, passive liveness, password always available as fallback. See `docs/FACIAL_AUTHENTICATION.md` and `docs/PRIVACY.md`.

## Multi-tenancy

- `CompanyAccessService.assertPermission(userId, companyId, perm)` is the single gate for every company-scoped resource.
- Company ids are never trusted from bodies/queries; the tenant is resolved from the authenticated user's active membership (route `:companyId`, `X-Company-Id` header, or single membership).
- CV/private file downloads require an application link between the candidate and the requesting company; every CV access is audit-logged.
- Candidate profiles are only visible to companies with a recruitment relationship unless the candidate sets visibility to `PUBLIC`.
- The e2e security suite (`test/e2e/security.e2e-spec.ts`) proves cross-tenant isolation, IDOR prevention, header-spoofing rejection, suspension revocation, and admin-only access.

## Queues & background jobs

| Queue             | Purpose                                          | Retry/backoff |
| ----------------- | ------------------------------------------------ | ------------- |
| `email`           | Transactional emails (verification, invites…)    | 5 × exponential |
| `notifications`   | DB notifications + realtime + optional email     | 3 × exponential |
| `ai`              | AI analyses (CV analyze/generate, match, …)      | 4 × exponential |
| `cv_processing`   | CV text extraction via AI service                | 3 × exponential |
| `analytics`       | Cache invalidation                               | 3 × exponential |
| `automation`      | Automation rule execution                        | 3 × exponential |

Deduplication uses BullMQ custom job ids (sanitized — see `common/utils/job-ids.ts`), so retries never produce duplicate emails or duplicate processing.

## Realtime

Socket.IO at the same port as the API. Clients connect with `{ auth: { token: <access JWT> } }`; each socket joins `user:{id}` and `company:{membershipId}` rooms. Events (`notification.created`, `application.updated`, `candidate.moved`, `interview.updated`, …) are published over Redis and forwarded only to the target room — tenants never receive each other's events.

## AI service (`ai-service/`)

FastAPI service with endpoints `/ai/cv/extract`, `/ai/cv/analyze`, `/ai/cv/generate`, `/ai/job/analyze`, `/ai/match`, `/ai/cover-letter`, `/ai/interview`. Providers are pluggable: `rule_based` (offline, deterministic — default in dev/tests) and `openai` (`OPENAI_API_KEY`, `OPENAI_MODEL`). The NestJS backend talks to it only through BullMQ workers and stores results in `AiAnalysis` (PENDING → PROCESSING → COMPLETED/FAILED). The frontend never calls the AI service directly.

## Storage

`StorageService` abstraction with two providers: `local` (dev/tests, HMAC-signed URLs) and `s3` (any S3-compatible endpoint — MinIO, AWS, DigitalOcean Spaces; presigned URLs). Files are stored privately; downloads require per-resource authorization (owner, or company with an application link for CVs). MIME type, extension and size are validated server-side.

## Billing

Plans (`FREE`/`PRO` candidate; `TRIAL`/`BUSINESS`/`PRO`/`ENTERPRISE` company) carry JSON `features` consumed exclusively through `EntitlementService` — business logic never branches on plan names. Limits enforced today: team size (active members + pending invites) and active job counts. Webhook events are authoritative: subscriptions only activate via `checkout.session.completed` with a verified signature. Payment provider is abstracted (`dev` provider for local/testing; Stripe adapter scaffolded) so a Tunisia-compatible provider can be swapped in without touching business logic.

## Admin

`/api/v1/admin/*` (platform admin only): users (list/update/suspend), companies, company verifications (approve/reject with documents), jobs (approve/reject), audit logs, subscriptions, platform analytics.

## Seed data

`npm run prisma:seed` creates clearly fictional data: 1 platform admin, 3 companies (Acme/Globex/Initech — one pending verification), full teams (HR/recruiter/hiring manager/interviewer), 4 candidates with skills/experience/education, 7 jobs across statuses, 4 applications with pipeline events, 1 automation rule and 1 assessment. Passwords: `Password123!` for every seeded account.

## Environment variables

See `.env.example` for the full annotated list. Minimum set:

```
NODE_ENV, PORT, API_PREFIX, FRONTEND_URL, CORS_ORIGINS
DATABASE_URL
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, REFRESH_TOKEN_TTL_DAYS, BCRYPT_ROUNDS
REDIS_URL
STORAGE_PROVIDER (local|s3), LOCAL_STORAGE_DIR, STORAGE_SIGNING_SECRET
S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
EMAIL_PROVIDER (console|smtp), SMTP_HOST/PORT/USER/PASS, EMAIL_FROM
AI_SERVICE_URL, AI_API_KEY
PAYMENT_PROVIDER (dev|stripe), DEV_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MAP_*
RUN_WORKERS (true in the worker process)
THROTTLE_ENABLED, AUTH_THROTTLE_LIMIT
```

## Docker

`docker compose up` starts Postgres, Redis, MinIO, Mailpit, the API, the worker and the AI service. The API container runs `prisma migrate deploy && prisma db seed && node dist/main.js`; the worker runs `node dist/worker-main.js` with `RUN_WORKERS=true`. CI (`.github/workflows/ci.yml`) runs lint, typecheck, Prisma validation, unit tests, migrations + seed, production build and the full e2e suite against service containers, plus the AI service test suite.

## Deployment

- **Production VPS**: [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md) — exact commands for DNS, Docker, Caddy HTTPS, migrations, backups, Stripe, SMTP, S3, AI.
- **Staging simulation**: [`docs/STAGING_DEPLOYMENT.md`](docs/STAGING_DEPLOYMENT.md) — the verified production-compose runbook.
- **Backup/restore**: [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).
- **Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **Frontend integration contract**: [`docs/FRONTEND_INTEGRATION.md`](docs/FRONTEND_INTEGRATION.md).
- **Beta launch gate**: [`docs/BETA_LAUNCH_CHECKLIST.md`](docs/BETA_LAUNCH_CHECKLIST.md).
- **Environment templates**: `.env.example` (dev), `.env.staging.example` (staging), `.env.production.example` (production, grouped + mandatory/optional annotations).

The seed refuses to run when `NODE_ENV=production` unless `SEED_FORCE=true` — demo data never lands on a production database automatically.

## External credentials still required for production

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — strong random values (min 16 chars)
- S3 keys + endpoint/bucket (or keep `local` with a persistent volume)
- SMTP credentials (or a transactional provider via nodemailer)
- `OPENAI_API_KEY` (or another provider) + `AI_PROVIDER=openai`
- Stripe keys + webhook secret + price map (or a Tunisia-compatible provider adapter)
- `STORAGE_SIGNING_SECRET` for local signed URLs in multi-instance deployments

## Security notes

- Passwords hashed with bcrypt; refresh tokens stored hashed; never returned in responses.
- Helmet, CORS allow-list, global validation (`whitelist` + `forbidNonWhitelisted`), rate limiting (global + stricter on auth routes).
- Audit log records auth events, company verification, job approval/deletion, application pipeline moves, CV/document access, team changes and subscription changes.
- Generic auth error messages prevent account enumeration; password-reset always responds identically.
- No card data is ever stored; webhook signatures are verified; `rawBody` is preserved for Stripe.
=======
# EasyJob

> AI-powered recruitment platform for smarter job search, CV optimization, job matching, and intelligent hiring.

EasyJob is a full-stack AI-powered recruitment platform designed to connect **job seekers and companies** through intelligent job matching, ATS-powered CV analysis, AI-assisted applications, and modern recruitment tools.

The platform helps candidates improve their CVs, discover relevant job opportunities, and manage applications, while companies can publish jobs, evaluate candidates, manage recruitment pipelines, and use AI-assisted recruitment tools.

---

## ✨ Features

### 👤 For Candidates

- 🔎 Real job search and filtering
- 🤖 AI-powered job matching
- 📄 CV upload and parsing
- 📊 ATS CV analysis and scoring
- 💡 Personalized CV improvement recommendations
- 📝 AI-assisted CV creation and optimization
- ✉️ AI-assisted cover letter generation
- 💼 Job applications directly through EasyJob when supported
- 🔖 Saved jobs
- 📋 Application tracking
- 🔔 Job alerts and notifications
- 🎯 Personalized job recommendations
- 🎤 AI interview coaching
- 👤 Complete professional profile
- 🌍 Multilingual interface
- 🌙 Dark mode

### 🏢 For Companies

- 📢 Job creation and publishing
- 👥 Candidate management
- 📋 Application management
- 🤖 AI-powered candidate analysis
- 📊 Candidate matching and ranking
- 🔎 Candidate search and filtering
- 🧠 AI recruitment insights
- 📌 Recruitment pipeline management
- 🎤 Interview management
- 📝 Assessments
- 📈 Recruitment analytics
- 👨‍💼 Team and recruiter management
- 🔐 Role-based permissions
- 🔔 Recruitment notifications
- 💳 Subscription and billing management

---

## 🤖 AI & ATS

EasyJob's ATS engine goes beyond simple keyword matching.

It analyzes the relationship between the candidate and the job using factors such as:

- Skills
- Required vs preferred requirements
- Professional experience
- Relevant experience
- Responsibilities
- Seniority
- Education
- Certifications
- Languages
- Location
- Workplace type
- Keywords and terminology
- CV structure
- ATS readability
- Measurable achievements
- Transferable skills

The system provides:

- ATS score
- Match score
- Score breakdown
- Matching skills
- Partial matches
- Missing requirements
- Relevant experience
- Strengths
- Gaps
- Evidence
- Actionable recommendations

AI-generated analysis is designed as **decision support**, not as an automatic hiring decision.

---

## 🧠 AI Interview Coach

EasyJob includes an AI-assisted interview experience capable of helping candidates prepare for:

- Technical interviews
- HR interviews
- Behavioral interviews
- Situational questions
- Problem-solving questions
- Role-specific interviews

The system can provide feedback on job-relevant factors such as:

- Answer quality
- Technical understanding
- Communication
- Problem solving
- Speaking pace
- Posture and presentation

Sensitive or protected characteristics are not used for recruitment scoring.

---

## 🏗️ Architecture

EasyJob is built as a modern full-stack application with separate services for the web application, API, AI processing, database, caching, background jobs, and search.

```text
                         ┌──────────────────────┐
                         │      EasyJob Web     │
                         │ Next.js / React / TS │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     NestJS API       │
                         │    REST / WebSocket  │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └────────────┐
                    ▼                                 ▼
          ┌──────────────────┐              ┌──────────────────┐
          │   PostgreSQL     │              │   Redis / BullMQ │
          │   + Prisma       │              │ Background Jobs  │
          └──────────────────┘              └──────────────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │    Python AI API   │
                       │      FastAPI       │
                       └────────────────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │ AI / ATS Services  │
                       └────────────────────┘
>>>>>>> 113d876e0083fb072ef036c4c389fbf619bc478e
