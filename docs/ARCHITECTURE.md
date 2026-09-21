# Startup Starter — Architecture

## 1. System overview

Startup Starter is a multi-tenant recruitment SaaS. Three applications:

| App | Stack | Purpose |
|-----|-------|---------|
| `web/` | Next.js 16 (App Router), React 19, TypeScript, Tailwind, shadcn/ui, TanStack Query, RHF+Zod, Socket.IO client | Candidate/company/admin UI |
| Backend (repo root) | NestJS, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO | REST API `/api/v1`, queues, realtime, billing, storage |
| `ai-service/` | FastAPI (Python) | AI: CV extraction/analysis, job matching, generation |

```
Browser
  │  HTTPS REST (/api/v1) + WSS (Socket.IO)
  ▼
Caddy ──► Next.js web ──────────────┐
  │                                 │
  └──► NestJS API ──► PostgreSQL    │
          │   └──► Redis (BullMQ + pub/sub)
          ▼
       worker ──► Redis queues
          ├──► FastAPI AI ──► OpenAI (optional)
          ├──► S3 storage (signed URLs)
          └──► SMTP email
```

## 2. Backend modules

```
src/
├── auth/            JWT access + rotating refresh (httpOnly), verification, reset
├── users/ roles/ permissions/    users, RBAC roles & permission catalog
├── companies/ company-members/ company-invitations/ company-verification/
├── candidates/ resumes/ files/  profiles, skills, experience, education, CVs, storage
├── jobs/ search/    job lifecycle (DRAFT→PUBLISHED→EXPIRED), PostgreSQL search
├── applications/ application-events/ interviews/
├── notifications/ realtime/      DB notifications + Socket.IO (Redis pub/sub bus)
├── admin/ audit/    platform admin APIs + centralized audit log
├── subscriptions/ plans/ payments/ entitlements/   billing + feature entitlements
├── automation/ assessments/      automation rules; assessment foundation
├── analytics/       company + admin analytics
├── ai/              AI client + BullMQ processors (CV, analysis, matching)
├── queues/          BullMQ queues (email, notifications, AI, CV, analytics, automation)
└── common/          guards (JWT, roles, permissions, company context), decorators,
                     interceptors, filters, pipes, constants, utils
```

Controllers are thin; business logic lives in services; multi-step writes use
Prisma transactions; authorization is enforced in guards + per-service tenant
checks (never trusting client-supplied `companyId`).

## 3. Data model (PostgreSQL/Prisma)

Core entities: `User`, `Role`, `Permission`, `Company`, `CompanyMember`,
`CompanyInvitation`, `CompanyVerification`, `CandidateProfile`, `Skill`,
`Experience`, `Education`, `Resume`, `Job`, `JobSkill`, `Application`,
`ApplicationEvent`, `Interview`, `Notification`, `AuditLog`, `Plan`,
`Subscription`, `Payment`, `ProcessedWebhookEvent`, `AiAnalysis`, `Automation*`,
`Assessment*`.

Key constraints: `Application @@unique([jobId, candidateId])` (no duplicates),
`ProcessedWebhookEvent @@unique([provider, eventId])` (webhook idempotency),
unique user email, indexes on hot query columns.

## 4. Authentication & RBAC

- bcrypt(12) password hashing; JWT HS256 access tokens (15 min) with `type`
  claim; refresh tokens stored as SHA-256 with rotation, 30-day TTL, httpOnly
  `Secure` cookie.
- Email verification + password reset via single-use emailed tokens.
- Roles: `PLATFORM_ADMIN`, `COMPANY_ADMIN`, `HR`, `RECRUITER`,
  `HIRING_MANAGER`, `INTERVIEWER`, `CANDIDATE`. Permissions enforced by
  `@Roles`/`@Permissions` guards plus company-context guards that derive the
  tenant from the authenticated membership (`X-Company-Id` + membership check).
- **Face login (optional, `BIOMETRIC_ENABLED=false` by default):** candidates and
  company users may enroll an encrypted biometric template (AES-256-GCM) via the
  FastAPI face module (OpenCV detection → quality → passive liveness → 128-d
  embedding) and sign in with their face through single-use challenges. NestJS
  remains the authentication authority — the AI service never issues sessions and
  never stores frames. See `docs/FACIAL_AUTHENTICATION.md`.

## 5. Multi-tenancy

The tenant is always derived from the authenticated user's active membership —
never from request bodies or query parameters. Every company-scoped service
asserts the resource belongs to the caller's company (job → application →
interview → CV chains). Cross-tenant access returns 403/404; a 13-test E2E
security suite covers IDOR, body/query spoofing, suspended users, and
candidate↔company↔admin boundaries.

## 6. Queues (BullMQ/Redis)

Queues: `email`, `notifications`, `ai`, `cv-processing`, `analytics`,
`automation`. Retries with exponential backoff, `safeJobId` dedupe (no
duplicate emails), FAILED states recorded, and graceful worker restart recovery.

## 7. Realtime (Socket.IO)

- Handshake authenticates the JWT; rooms are `user:{id}` and `company:{id}`,
  joined only from active memberships.
- API and worker processes share a Redis pub/sub bus (`realtime:events`);
  the API gateway relays each event to its room exactly once (no duplicate
  emits, no cross-tenant leakage).
- Events: `notification.created`, `application.updated`, `interview.updated`,
  `candidate.moved`, `message.created`.

## 8. Storage

`StorageService` abstraction with `local` and `s3` providers. Files are private;
downloads use short-lived signed URLs (HMAC-signed for local, presigned for
S3). CV access is authorized by ownership or an application link to the
caller's company, and every download is audit-logged.

## 9. AI

`ai-service` (FastAPI) is backend-to-backend only: Bearer `AI_API_KEY`, browser
origins denied, `rule_based` provider (zero-cost) or `openai`. The NestJS
worker enqueues extraction/analysis asynchronously; results land in `AiAnalysis`
(PENDING → PROCESSING → COMPLETED/FAILED). AI failure never blocks core flows.

## 10. Billing

`Plan`/`Subscription`/`Payment` models; checkout is server-initiated; Stripe
webhooks are signature-verified and idempotent (ledger table); entitlements
(`team.members`, `activeJobs`, `ai.*`, …) are enforced server-side and
recomputed from the subscription plan.

## 11. Security summary

HTTPS-only (Caddy + Let's Encrypt), HSTS, nosniff, frame/ref-referrer/
permissions headers, secure httpOnly cookies, CORS allow-list, throttling
(auth endpoints stricter), input validation via whitelisted DTOs, no secrets in
the frontend or Git, audit logging for sensitive actions.
