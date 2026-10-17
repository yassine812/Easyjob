# Startup Starter — Frontend Integration Contract

**Source of truth: the running backend code.** Every route, payload, response shape, status value and event name below was extracted from the actual controllers, DTOs, guards, services, Prisma schema and the FastAPI service. If anything here conflicts with the code, the code wins.

Version: backend `1.0.0` (NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis/BullMQ 5 + Socket.IO + FastAPI AI service).

---

## 1. API Base Configuration

| Setting | Value | Where it comes from |
| --- | --- | --- |
| API base URL (dev) | `http://localhost:3000/api/v1` | `PORT` (default `3000`), `API_PREFIX` (default `api/v1`) |
| API versioning | Path prefix `api/v1` only | `app.setGlobalPrefix(config.apiPrefix)` |
| Swagger/OpenAPI | `http://localhost:3000/docs` (disabled in `NODE_ENV=production`) | `src/main.ts` |
| Health check | `GET /api/v1/health` (public) → `{ status, info: { database, redis }, error, details }` | `src/health` |
| CORS | `CORS_ORIGINS` comma list; `credentials: true`; allowed headers include `Content-Type`, `Authorization`, `X-Company-Id`, `X-Request-Id`; methods GET/POST/PATCH/PUT/DELETE/OPTIONS | `src/main.ts` |
| Realtime endpoint | Socket.IO on the **same host/port as the API** (default `http://localhost:3000`) | `RealtimeGateway` (no separate port) |

**Required frontend environment variables**

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3000          # same origin as the API for Socket.IO
NEXT_PUBLIC_FRONTEND_URL=http://localhost:5173    # used in payment success/cancel links
```

**Development vs production**

- Dev: API on `:3000`, frontend on `:5173` (both are **same-site**, so the `SameSite=Lax` refresh cookie is sent automatically when using `credentials: 'include'`). CORS already allows `http://localhost:5173`.
- Production: set `CORS_ORIGINS` to the frontend origin(s), `COOKIE_SECURE=true` (it defaults to true in production), `COOKIE_DOMAIN` if the API is served from a different subdomain, and `FRONTEND_URL` for payment redirects and email links.
- Always send `credentials: 'include'` on `fetch`/axios so the httpOnly refresh cookie round-trips.

---

## 2. Authentication Flow

**Model:** JWT **access tokens** (short-lived, default `15m`, in the `Authorization: Bearer` header) + opaque **refresh tokens** (default 30 days, stored **hashed** server-side, delivered as an **httpOnly cookie** `refresh_token`, also accepted in the request body). Refresh tokens **rotate on every use** — the presented token is revoked and a new one issued, so replaying an old refresh token returns `401`.

All auth endpoints except `me`/`logout` behavior are `@Public`. Auth endpoints are throttled (10 requests / 60 s per route; disabled in tests).

### Endpoints

**POST `/api/v1/auth/register`** — `201 Created`
```jsonc
// Request
{ "name": "Jane Doe", "email": "jane@example.com", "password": "Str0ng!Passw0rd", "phone": "+216 20 000 000" } // phone optional
// Response 201
{ "id": "cuid", "name": "Jane Doe", "email": "jane@example.com" }
```
- Validation: email format, password 8–72 chars with lowercase+uppercase+digit, max name 120.
- Creates the user with role `CANDIDATE` + an empty `CandidateProfile`, then sends a verification email. Duplicate email → `400`.
- **After registering, the account is not usable until the email is verified** (login still succeeds, but company creation and job applications are blocked with `403`).

**POST `/api/v1/auth/login`** — `200 OK`
```jsonc
// Request
{ "email": "jane@example.com", "password": "Str0ng!Passw0rd" }
// Response 200 — ALSO sets httpOnly cookie "refresh_token"
{
  "accessToken": "<jwt>",
  "user": { "id": "cuid", "name": "Jane Doe", "email": "jane@example.com",
            "emailVerified": false, "roles": ["CANDIDATE"] }
}
```
- Wrong credentials → `401` with the exact same generic message for unknown email and wrong password (`"Invalid email or password"`) — never enumerate accounts.
- Suspended accounts → `401 "Account is suspended"`.

**POST `/api/v1/auth/refresh`** — `200 OK` (public)
```jsonc
// Request — either the httpOnly cookie OR the body:
{ "refreshToken": "<opaque token>" }
// Response 200 — ALSO sets a NEW httpOnly cookie
{ "accessToken": "<new jwt>", "refreshToken": "<new opaque token>" }
```
- Old refresh token is revoked the moment it is used. Reusing an already-used token → `401`.

**POST `/api/v1/auth/logout`** — `204 No Content` (public)
```jsonc
// Request — body (or cookie):
{ "refreshToken": "<opaque token>" }
```
- Revokes the presented refresh token and clears the cookie. No body needed if the cookie is sent.

**POST `/api/v1/auth/verify-email`** — `200` (public)
```jsonc
// Request
{ "token": "<from email link ?token=...>" }
// Response 200
{ "verified": true }
```
- Token is single-use and expires (7 days). Invalid/used/expired → `400 "Invalid or expired verification token"`.

**POST `/api/v1/auth/resend-verification`** — `200` (public, throttled)
```jsonc
// Request
{ "email": "jane@example.com" }
// Response 200 — identical whether or not the account exists
{ "sent": true }
```

**POST `/api/v1/auth/forgot-password`** — `200` (public, throttled)
```jsonc
// Request
{ "email": "jane@example.com" }
// Response 200 — identical whether or not the account exists (no enumeration)
{ "sent": true }
```
- Emails a link `<FRONTEND_URL>/reset-password?token=<raw>` (1-hour expiry).

**POST `/api/v1/auth/reset-password`** — `200` (public)
```jsonc
// Request
{ "token": "<from email link>", "newPassword": "NewStr0ng!Passw0rd" }
// Response 200
{ "success": true }
```
- Single-use. Invalid/used/expired → `400`. Also revokes **all** refresh tokens of the user.

**GET `/api/v1/auth/me`** — `200` (protected)
```jsonc
{
  "id": "cuid", "name": "Jane Doe", "email": "jane@example.com",
  "phone": null, "status": "ACTIVE", "emailVerified": false,
  "lastLoginAt": "2026-08-13T12:00:00.000Z", "createdAt": "2026-08-13T10:00:00.000Z",
  "roles": ["CANDIDATE"],
  "candidateProfileId": "cuid-or-null",
  "memberships": [
    { "companyId": "cuid", "companyName": "Acme", "companySlug": "acme",
      "companyStatus": "ACTIVE", "role": "COMPANY_ADMIN" }
  ]
}
```
- **`roles` + `memberships` are the two pieces of data that drive the entire frontend navigation/RBAC.** `memberships` contains the user's role *within each company* (the tenant role). Note there is **no `permissions` array** returned — the frontend must derive capability from `roles` (platform) and membership `role` (tenant), or by calling the API and handling `403`.

### Refresh/401 strategy the frontend must implement

1. Store the **access token in memory** (React context/Zustand — never `localStorage` for the access token; in-memory mitigates XSS token theft).
2. On every API call, attach `Authorization: Bearer <accessToken>`, `credentials: 'include'`, and `X-Request-Id` (UUID) if you want request correlation.
3. On **`401`**: attempt a single-flight refresh (one shared promise so concurrent 401s don't spam `/refresh`). If refresh succeeds, retry the original request once with the new token. If refresh fails, clear auth state and redirect to `/login`.
4. Note: `401` is also returned for *invalid* access tokens (tampered, wrong type) and for suspended accounts — after a successful refresh you can re-check `/auth/me`; a subsequent `401 "Account is not active"` means the user is suspended and should be logged out.
5. Never call `/auth/refresh` more than once concurrently; the backend rotation makes parallel refreshes with the same token fail.

### Error responses (auth and everywhere)

```jsonc
{ "statusCode": 400, "message": "email must be an email, Password must contain lowercase, uppercase and a digit, password must be longer than or equal to 8 characters", "error": "Bad Request", "requestId": "-", "path": "/api/v1/auth/register", "timestamp": "2026-08-13T12:00:00.000Z" }
```
- Validation messages are **joined with ", "** into a single `message` string (not an array).

---

## 3. User Roles

Platform roles (returned in `/auth/me.roles` and by the `@Roles` guard): `PLATFORM_ADMIN`, `COMPANY_ADMIN`, `HR`, `RECRUITER`, `HIRING_MANAGER`, `INTERVIEWER`, `CANDIDATE`.

**Tenant roles** (`COMPANY_ADMIN`, `HR`, `RECRUITER`, `HIRING_MANAGER`, `INTERVIEWER`) are assigned per-company via `memberships[].role` and gate company-scoped endpoints through `@CompanyPermissions(...)`. **`CANDIDATE` is the platform role every registered user gets; tenant roles are granted on top when a user joins a company.**

Permission → role matrix (exact, from `src/common/constants/roles.ts`):

| Permission | PLATFORM_ADMIN | COMPANY_ADMIN | HR | RECRUITER | HIRING_MANAGER | INTERVIEWER | CANDIDATE |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| candidate.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| candidate.cv.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| job.create | ✅ | ✅ | ✅ | ✅ | – | – | – |
| job.update | ✅ | ✅ | ✅ | ✅ | – | – | – |
| job.delete | ✅ | ✅ | – | – | – | – | – |
| job.publish | ✅ | ✅ | ✅ | ✅ | – | – | – |
| job.approve (platform) | ✅ | – | – | – | – | – | – |
| application.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| application.update | ✅ | ✅ | ✅ | ✅ | ✅ | – | – |
| application.move | ✅ | ✅ | ✅ | ✅ | ✅ | – | – |
| team.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| team.invite | ✅ | ✅ | ✅ | – | – | – | – |
| team.manage | ✅ | ✅ | – | – | – | – | – |
| interview.create | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| interview.update | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| analytics.view | ✅ | ✅ | ✅ | ✅ | ✅ | – | – |
| billing.view | ✅ | ✅ | – | – | – | – | – |
| billing.manage | ✅ | ✅ | – | – | – | – | – |
| automation.manage | ✅ | ✅ | – | – | – | – | – |
| assessment.manage | ✅ | ✅ | – | – | – | – | – |
| admin.users / admin.companies / admin.verifications / admin.jobs / admin.analytics / admin.subscriptions / admin.audit | ✅ | – | – | – | – | – | – |

**Role-by-role guidance for the frontend:**

- **PLATFORM_ADMIN** — everything, including `/admin/*`. Sees the admin workspace (users, companies, verifications, jobs moderation, subscriptions, audit logs, platform analytics). Should not normally use the candidate/company workspaces, but technically can.
- **COMPANY_ADMIN** — full company workspace: all jobs actions (create/update/delete/publish), applications pipeline, interviews, team management (invite, change roles, remove members), company profile + verification, billing, automation, assessments, analytics. Cannot approve jobs (platform moderation) and cannot access `/admin/*`.
- **HR** — create/update/publish jobs (no delete), applications (view/move), candidates, interviews, invite team members (`team.invite`), view team, analytics. Cannot manage billing, automation, assessments, or remove/change-role members.
- **RECRUITER** — same as HR minus `team.invite` (cannot invite).
- **HIRING_MANAGER** — applications (view/move), candidates, interviews, view team, analytics. Cannot create/edit jobs.
- **INTERVIEWER** — view applications/candidates/CVs, create + update interviews. Nothing else.
- **CANDIDATE** — no company permissions. Candidate workspace only: profile, CVs, saved jobs, applications, AI, subscription.

**Suggested frontend routing gating:** gate pages on *platform* `roles` for `/admin/*` (PLATFORM_ADMIN only); gate company pages on the *active company's* membership role. For fine-grained buttons use the permission matrix above (mirror it as a small constant table in the frontend), and always handle `403` from the API as the final authority.

---

## 4. Company Flow

Company lifecycle: **register user → verify email → create company (`PENDING_VERIFICATION`) → upload verification documents → submit → admin approves → `ACTIVE`** (or admin rejects → `REJECTED`, resubmittable). A company can be suspended by an admin (`SUSPENDED`).

### Endpoints

**POST `/api/v1/companies`** — `201 Created` (protected; requires verified email → else `403`)
```jsonc
// Request (all optional except legalName + commercialName)
{ "legalName": "Acme Inc.", "commercialName": "Acme", "website": "https://acme.example.com",
  "industry": "SaaS", "description": "...", "address": "...", "city": "Tunis",
  "country": "TN", "phone": "...", "professionalEmail": "contact@acme.example.com",
  "registrationIdentifier": "REG-123" }
// Response 201 — company DTO (status is PENDING_VERIFICATION)
{ "id": "cuid", "legalName": "Acme Inc.", "commercialName": "Acme", "slug": "acme",
  "website": "...", "industry": "SaaS", "description": null, "address": null, "city": "Tunis",
  "country": "TN", "phone": null, "professionalEmail": "...", "registrationIdentifier": "REG-123",
  "status": "PENDING_VERIFICATION", "createdAt": "...", "updatedAt": "..." }
```
- The creator becomes `COMPANY_ADMIN` and a `CompanyVerification` row (`PENDING`) is created automatically. A `company.registered` notification is emitted to the creator.

**GET `/api/v1/companies/:id`** — `200` (**public**) — same DTO plus `members: [{ id, role, name, userId }]` when present.

**PATCH `/api/v1/companies/:id`** — `200` (tenant `team.manage`) — same fields as create, all optional.

**GET `/api/v1/companies/me/list`** — `200` (protected) — the user's companies:
```jsonc
[ { "id": "...", "commercialName": "Acme", "slug": "acme", "status": "ACTIVE", /* ...company DTO... */,
    "myRole": "COMPANY_ADMIN" } ]
```

**GET `/api/v1/companies/:id/members`** — `200` (tenant `team.view`)
```jsonc
[ { "id": "memberId", "userId": "cuid", "name": "Ali Admin", "email": "ali@acme.example.com",
    "role": "COMPANY_ADMIN", "status": "ACTIVE", "createdAt": "..." } ]
```

**Company verification** (`/api/v1/companies/:companyId/verification…`, tenant `team.manage`):
- `GET .../verification` → the `CompanyVerification` record + `documents: [{ id, filename, mimeType, fileSize, createdAt }]`
- `POST .../verification/documents` — multipart field **`file`**, ≤ 10 MB, allowed types (see §15) → `{ id, filename, mimeType, fileSize }`
- `POST .../verification/submit` — body **empty** → `{ status: "UNDER_REVIEW", submittedAt }`; requires ≥ 1 document (`400` otherwise); already-verified → `{ status: "VERIFIED" }`
- Statuses: `PENDING` → `UNDER_REVIEW` → `VERIFIED` | `REJECTED`. On approval the company becomes `ACTIVE` and admins get a `company.verified` notification; on rejection, `company.rejected` with the reason in the message.

**Team invitations** (`/api/v1/companies/:companyId/invitations`):
- `POST .../invitations` (tenant `team.invite`) — `{ "email": "hr@acme.example.com", "role": "HR" }` (role must be one of `COMPANY_ADMIN | HR | RECRUITER | HIRING_MANAGER | INTERVIEWER`) → `201`
  ```jsonc
  { "id": "invId", "email": "hr@...", "role": "HR", "status": "PENDING",
    "expiresAt": "...+7d", "invitationUrl": "http://localhost:5173/invitations/accept?token=<raw>" }
  ```
  `invitationUrl` is only returned when the email provider is `console` (dev/test). In production the user receives the link **by email** at `<FRONTEND_URL>/invitations/accept?token=<raw>` — the frontend must support this route.
  - Enforces the plan's `team.members` limit (active members + pending invitations) → `403` when reached.
  - Duplicate pending invitation for the same email → `400`. Already a member → `400`.
- `GET .../invitations` (tenant `team.invite`) → list of invitations
- `DELETE .../invitations/:invitationId` (tenant `team.manage`) → `{ success: true }` (revokes)
- `POST /api/v1/company-invitations/accept` (protected) — `{ "token": "<raw>" }` → `201`
  ```jsonc
  { "success": true, "companyId": "...", "companyName": "Acme", "role": "HR" }
  ```
  - Requires the authenticated user's **email to match** the invited email (`403` otherwise). Single-use, 7-day expiry. Creates the `CompanyMember` and adds the tenant role to the user's platform roles.

**Members management** (tenant `team.manage`):
- `PATCH /api/v1/companies/:companyId/members/:memberId` — `{ "role": "HR" }` → `200 { id, name, email, role, status }`
- `DELETE /api/v1/companies/:companyId/members/:memberId` — `200 { success: true }` (soft-removes: sets `INACTIVE`)
- Guard rails: cannot remove yourself; a company must keep ≥ 1 `COMPANY_ADMIN` (demoting/removing the last admin → `400`).

**Company switching:** there is **no dedicated "switch company" endpoint**. The user's memberships come from `/auth/me`. For every company-scoped request the frontend supplies the company context via the **route param `:companyId`** (preferred) or the **`X-Company-Id` header**. Endpoints with neither (e.g. `POST /jobs`) resolve the context automatically **only when the user belongs to exactly one company**; otherwise the backend returns `403` with `"Company context required: pass :companyId route param, X-Company-Id header, or belong to a single company"`. So the frontend should **always** pass the active company explicitly.

**Company status restrictions:** `SUSPENDED` companies still authenticate, but the frontend should surface the suspension from `memberships[].companyStatus` / the company DTO and disable company actions.

---

## 5. Candidate Flow

Base path `/api/v1/candidates` (all protected).

### Profile
- `GET /candidates/me` → profile with `savedJobs`, `skills` (`[{ id, name, level }]`), `experiences`, `educations`, `resumes`, `jobPreference`.
- `PATCH /candidates/me` — all optional: `{ headline, bio, location, phone, yearsExperience (0–60), visibility, remotePreference, employmentTypePreference }` → updated profile DTO.
  - `visibility`: `PUBLIC | RECRUITERS_ONLY | PRIVATE` (default `RECRUITERS_ONLY`). `PUBLIC` profiles can be viewed by any company member; `RECRUITERS_ONLY`/`PRIVATE` profiles are only viewable by companies with an application from that candidate.

### Skills
- `POST /candidates/me/skills` — `{ "name": "TypeScript", "level": "ADVANCED" }` (`level`: `BEGINNER|INTERMEDIATE|ADVANCED|EXPERT`, default `INTERMEDIATE`) → `201 { skillId, name, level }` (upserts the global skill + links it)
- `DELETE /candidates/me/skills/:skillId` → `{ success: true }`

### Experience
- `POST /candidates/me/experiences` — `{ companyName, title, description?, startDate: "2020-01-01", endDate?, current? }` → `201` (created record; dates are ISO date strings)
- `PATCH /candidates/me/experiences/:id` — same fields → updated record
- `DELETE /candidates/me/experiences/:id` → `{ success: true }`

### Education
- `POST /candidates/me/education` — `{ institution, degree?, field?, startDate?, endDate? }` → `201`
- `PATCH /candidates/me/education/:id`, `DELETE /candidates/me/education/:id`

### Resumes / CVs (see also §15)
- `POST /candidates/me/resumes` — multipart field **`file`** → `201`
  ```jsonc
  { "id": "resumeId", "filename": "cv.pdf", "mimeType": "application/pdf", "fileSize": 102400,
    "version": 1, "isPrimary": true, "processingStatus": "PENDING" }
  ```
  - The **first** uploaded CV becomes `isPrimary: true`. Every upload enqueues a CV-processing job; `processingStatus` transitions `PENDING → PROCESSING → COMPLETED | FAILED` (text files are parsed in-process; PDF/DOCX go through the AI extraction service).
- `GET /candidates/me/resumes` → array of `{ id, filename, mimeType, fileSize, version, isPrimary, processingStatus, createdAt }`
- `POST /candidates/me/resumes/:id/primary` → `{ success: true }`
- `DELETE /candidates/me/resumes/:id` → `{ success: true }` (deletes object storage too; promotes the next-highest version to primary)
- `GET /candidates/me/resumes/:id/download` → `200 { "url": "<signed url>", "filename": "cv.pdf" }` (owner only; see §15)
- Candidate CV limit: free plan `cv.uploads` = 3, PRO = 20 (`403` when exceeded).

### Saved jobs
- `POST /candidates/me/saved-jobs` — `{ jobId }` → `{ success: true }` (job must be `PUBLISHED` or `404`)
- `GET /candidates/me/saved-jobs` → list incl. job + company
- `DELETE /candidates/me/saved-jobs/:jobId` → `{ success: true }`

### Job preferences
- `GET /candidates/me/job-preferences` → `JobPreference | null`
- `PUT /candidates/me/job-preferences` — `{ jobTitle?, location?, remote?, employmentType?, experienceLevel?, salaryMin?, salaryMax?, currency?, keywords?: string[] }` → upserted record

### Application history
- `GET /applications/me?page&limit&status` → paginated candidate applications (see §7).

### Company view of a candidate
- `GET /candidates/:candidateProfileId` (tenant `candidate.view`) → profile (skills/experiences/educations/resumes; **contact `phone`/`email` only when there is an application link**). `403` when no application link and visibility is not `PUBLIC`.

---

## 6. Job Flow

Base path `/api/v1/jobs`. Search and detail are **public**; everything else is tenant-scoped.

### Job statuses (exact)
`DRAFT → PENDING_APPROVAL → APPROVED → PUBLISHED → EXPIRED | CLOSED` and `REJECTED` (from `PENDING_APPROVAL`). Editing is only allowed in `DRAFT` or `REJECTED`; publishing only from `APPROVED`; automatic expiration (`@Cron`, hourly) moves past-expiry `PUBLISHED` jobs to `EXPIRED`.

### Search / browse — `GET /api/v1/jobs` (public)
Query parameters (all optional):

| Param | Type | Notes |
| --- | --- | --- |
| `keyword` | string | ILIKE across title, description, location, requirements, responsibilities |
| `location` | string | ILIKE on job location |
| `remote` | `true`/`false` | boolean |
| `employmentType` | enum | `FULL_TIME\|PART_TIME\|CONTRACT\|INTERNSHIP\|FREELANCE` |
| `experienceLevel` | enum | `JUNIOR\|MID\|SENIOR\|LEAD\|EXECUTIVE` |
| `salaryMin` | int | `salaryMax >= salaryMin` |
| `salaryMax` | int | `salaryMin <= salaryMax` |
| `skills` | string | **comma-separated**, e.g. `?skills=typescript,node.js` (matched against skill `normalizedName`) |
| `companySlug` | string | company slug |
| `sort` | string | `relevance \| newest \| salaryHigh \| salaryLow \| title` (default `newest`) |
| `page` / `limit` | int | page ≥ 1; limit 1–100, default 20 |

- `status` is forced to `PUBLISHED` for public search.
- `keyword` + `sort=relevance` uses PostgreSQL full-text search (`tsvector` + `websearch_to_tsquery`).
- Response (paginated, see §17): `{ items, page, limit, total, totalPages }`, each item:
  ```jsonc
  { "id": "...", "companyId": "...", "createdById": "...", "title": "...", "slug": "...",
    "description": "...", "responsibilities": ["..."], "requirements": ["..."],
    "location": "Tunis", "remote": true, "employmentType": "FULL_TIME",
    "experienceLevel": "SENIOR", "salaryMin": 60000, "salaryMax": 90000, "currency": "USD",
    "status": "PUBLISHED", "expiresAt": "...", "publishedAt": "...", "rejectionReason": null,
    "createdAt": "...", "updatedAt": "...",
    "company": { "id": "...", "commercialName": "Acme", "slug": "acme", "logoKey": null },
    "skills": [ { "required": true, "level": "ADVANCED", "skill": { "id": "...", "name": "TypeScript", "normalizedName": "typescript" } } ] }
  ```

### Job detail — `GET /api/v1/jobs/:id` (public)
Same shape. **Non-public jobs return `404`** unless the caller is a member of the owning company (then the real status is returned) — this is deliberate to avoid leaking job existence.

### Company job list — `GET /api/v1/jobs/company/:companyId` (tenant `application.view`)
`?status=&page=&limit=` → paginated jobs (all statuses).

### Create — `POST /api/v1/jobs` (tenant `job.create`)
Body (from `CreateJobDto`):
```jsonc
{ "title": "Senior Backend Engineer",          // 3–150 chars
  "description": "We are hiring...",           // 20–10000 chars
  "responsibilities": ["Build APIs"],          // optional string[]
  "requirements": ["TypeScript"],              // optional string[]
  "location": "Tunis",                         // optional
  "remote": true,                              // optional bool
  "employmentType": "FULL_TIME",               // required enum
  "experienceLevel": "SENIOR",                 // required enum
  "salaryMin": 60000, "salaryMax": 90000,      // optional ints ≥ 0
  "currency": "USD",                           // optional
  "expiresAt": "2026-12-31T00:00:00.000Z",     // optional ISO datetime
  "skills": [ { "name": "TypeScript", "required": true, "level": "ADVANCED" } ] }  // optional
```
- Created as `DRAFT`; unique slug per company; **enforces the `activeJobs` plan limit** (`403` on TRIAL after 3 active jobs).
- Company context: route param or `X-Company-Id` header or single membership (§4).

### Update — `PATCH /api/v1/jobs/:id` (tenant `job.update`)
Same fields, all optional. `400` if the job is `PUBLISHED`, `EXPIRED` or `CLOSED`. `skills` replaces the whole skill set when provided.

### Workflow actions (all `200`)
- `POST /jobs/:id/submit` (tenant `job.update`) → `{ id, status: "PENDING_APPROVAL" }` — only from `DRAFT`/`REJECTED`
- `POST /jobs/:id/publish` (tenant `job.publish`) → `{ id, status: "PUBLISHED", publishedAt }` — only from `APPROVED`; `400` if `expiresAt` is in the past
- `POST /jobs/:id/close` (tenant `job.update`) → `{ id, status: "CLOSED" }` — idempotent
- `DELETE /jobs/:id` (tenant `job.delete`) → `{ success: true }` — **only HR/COMPANY_ADMIN/PLATFORM_ADMIN**; `409 Conflict` if the job has applications (close it instead)

### Approval (platform) — `/api/v1/admin/jobs/:id/approve|reject`
- `POST /admin/jobs/:id/approve` → `{ id, status: "APPROVED" }` (only from `PENDING_APPROVAL`)
- `POST /admin/jobs/:id/reject` — `{ "reason": "..." }` (≤500 chars) → `{ id, status: "REJECTED" }`
- Notifies the job creator (`job.approved` / `job.rejected`).

---

## 7. Application / Recruitment Pipeline

### Statuses (exact, forward-only)
`APPLIED → SCREENING → SHORTLISTED → ASSESSMENT → INTERVIEW → OFFER → HIRED`, plus `REJECTED` and `WITHDRAWN`.
- **Transition rule (single source of truth, `src/applications/pipeline.ts`):** moves must go *forward* along the pipeline, or to `REJECTED`/`WITHDRAWN`. Backwards moves → `400`. Terminal statuses `HIRED`, `REJECTED`, `WITHDRAWN` are final. Same-status → `400`.
- Every status change writes an `ApplicationEvent`; optional `note` also creates an `ApplicationNote`.

### Apply — `POST /api/v1/jobs/:jobId/apply` (protected, candidate)
```jsonc
// Request
{ "resumeId": "optional-cv-id", "motivation": "I am very interested." }  // motivation ≤ 4000
// Response 201 — full application DTO (see shape below)
```
Guards: job must be `PUBLISHED` and not expired (`400`); caller must have a verified email (`403`); the `resumeId` must belong to the candidate (`400`); **one application per job per candidate** (`400` duplicate).
Notify: job creator + company `COMPANY_ADMIN`/`HR`/`RECRUITER` members (`candidate.applied`).

### Application DTO (used by list/detail responses)
```jsonc
{ "id": "...", "jobId": "...", "candidateId": "...", "resumeId": "...", "motivation": "...",
  "status": "APPLIED", "appliedAt": "...", "updatedAt": "...",
  "job": { "id": "...", "title": "...", "slug": "...", "companyId": "...", "location": "...",
           "remote": true, "employmentType": "FULL_TIME",
           "company": { "id": "...", "commercialName": "Acme", "slug": "acme" } },
  "candidate": { "id": "...", "userId": "...", "headline": "...", "location": "...",
                 "user": { "id": "...", "name": "...", "email": "..." } },
  "resume": { "id": "...", "filename": "cv.pdf", "mimeType": "...", "fileSize": 123, "version": 1 } | null,
  "_count": { "events": 3, "notes": 1 } }
```

### Endpoints
- `GET /applications/me?page&limit&status` — candidate's own applications (paginated)
- `GET /companies/:companyId/applications?page&limit&status&jobId` — tenant `application.view` (paginated; includes the candidate DTO with contact info — candidate has applied to this company)
- `GET /applications/:id` — candidate owner **or** tenant `application.view`
- `PATCH /applications/:id/status` — `{ "newStatus": "SHORTLISTED", "note": "optional" }` → `200 { id, status }`
  - **Candidate can only set `WITHDRAWN` on their own application**; all other moves require tenant `application.move`. Candidate-initiated withdrawal of another candidate's application → `403`.
- `GET /applications/:id/events` — candidate owner or `application.view` → array:
  ```jsonc
  [ { "id": "...", "applicationId": "...", "actorId": "...", "previousStatus": "APPLIED",
      "newStatus": "SCREENING", "metadata": { "note": "..." } | null, "createdAt": "...",
      "actor": { "id": "...", "name": "Ali Admin" } } ]
  ```
- `GET /applications/:id/notes` — same authorization → `[{ id, applicationId, authorId, content, createdAt, author: { id, name } }]`
- `POST /applications/:id/notes` — `{ "content": "..." }` (≤4000) → `201` created note (tenant `application.update`)
- `GET /applications/:id/cv` — tenant `application.view` → `200 { url, filename }` (signed CV URL for the application's resume; every access is audit-logged). `404` if the application has no resume.

### Pipeline UI guidance
Company side shows candidates with `status`; moving a candidate uses `PATCH status`; the pipeline position for display = index of `status` in `[APPLIED, SCREENING, SHORTLISTED, ASSESSMENT, INTERVIEW, OFFER, HIRED]`. Candidate side shows `applications/me` and a withdraw action only when the status is not terminal.

---

## 8. Interviews

Base path `/api/v1/interviews` (all protected).

- `POST /interviews` — tenant `interview.create`:
  ```jsonc
  { "applicationId": "cuid", "startAt": "2026-08-20T10:00:00.000Z", "endAt": "2026-08-20T11:00:00.000Z",
    "type": "VIDEO", "location": "https://meet.example.com/xyz", "notes": "Technical interview" }
  ```
  `type`: `PHONE | VIDEO | ONSITE | TECHNICAL`. `endAt` must be after `startAt` (`400`). → `201` interview DTO (includes application/job/candidate + `scheduledBy`).
- `GET /interviews/:id` — candidate owner **or** tenant `application.view`.
- `GET /interviews/applications/:applicationId` — candidate owner or `application.view` → array of interviews (asc by `startAt`).
- `PATCH /interviews/:id` — tenant `interview.update`:
  ```jsonc
  { "startAt?": "...", "endAt?": "...", "type?": "...", "location?": "...", "notes?": "...",
    "status?": "CANCELLED" }
  ```
  Statuses: `SCHEDULED | CONFIRMED | COMPLETED | CANCELLED`. Completed/cancelled interviews cannot be edited (`400`). `SCHEDULED → CANCELLED` is allowed; other non-adjacent jumps are rejected (`400`).

**Participants:** the candidate (owner of the application) and company members with `application.view`/`interview.*` permissions. Interview `jobId` is derived from the application — the frontend never sends it.

**Notifications/realtime:** scheduling sends the candidate `interview.scheduled` (DB notification + email + realtime `interview.scheduled`); updates send `interview.updated`; the company room gets realtime `interview.updated`.

---

## 9. Notifications

Base path `/api/v1/notifications` (protected).

### REST endpoints
- `GET /notifications/me?page&limit&unreadOnly=true` → paginated `{ items: [...], page, limit, total, totalPages }`
- `PATCH /notifications/me/read-all` → `{ count }`
- `PATCH /notifications/me/:id/read` → `{ success: true }` (only own notifications)
- `DELETE /notifications/me/:id` → `{ success: true }`

### Notification shape
```jsonc
{ "id": "...", "userId": "...", "type": "candidate.applied", "title": "New application",
  "message": "A candidate applied to \"Senior Backend Engineer\".", "data": { "jobId": "..." },
  "readAt": null, "createdAt": "..." }
```

### Notification types the backend actually emits
`company.registered`, `company.verified`, `company.rejected`, `job.approved`, `job.rejected`, `candidate.applied`, `application.status_changed`, `interview.scheduled`, `interview.updated`, `team.invitation_accepted`, `team.role_changed`, `subscription.activated`, `payment.failed`, `subscription.canceled`, `ai.completed`, `assessment.invited`, `automation` (custom automation notifications).

### Realtime (Socket.IO)
- Connect: `io(NEXT_PUBLIC_WS_URL, { auth: { token: "<accessToken>" } })` — the handshake **must** carry the access JWT or the socket is disconnected.
- Rooms (server-assigned from authenticated data — the client never joins/emits manually):
  - `user:{userId}` — the user's private channel
  - `company:{companyId}` — one room per active membership
- **Events (exact names) + rooms + payloads:**

| Event | Room | Payload |
| --- | --- | --- |
| `notification.created` | `user:{id}` | full Notification object |
| `application.created` | `company:{id}` | `{ id, jobId }` |
| `application.updated` | `company:{id}` | `{ id, status }` (incl. withdrawals) |
| `candidate.moved` | `company:{id}` | `{ id, status }` |
| `application.status_changed` | `user:{id}` (candidate) | `{ id, jobId, status }` |
| `interview.scheduled` | `user:{id}` (candidate) | `{ id }` |
| `interview.updated` | `user:{id}` (candidate) + `company:{id}` | `{ id, status? }` |

- **Reconnection:** the client should reconnect with the current access token and re-fetch `/notifications/me` + any list pages on `connect` (rooms are re-joined server-side; events during the gap are missed — no replay).
- Tenant isolation is enforced by room assignment; Company A sockets never receive Company B events.

---

## 10. AI Features

**Architecture:** the frontend calls **NestJS endpoints only** — it never talks to the FastAPI service and never holds AI provider credentials (`AI_SERVICE_URL`, `AI_API_KEY`, `OPENAI_API_KEY` live only in backend/worker env). Flow: `POST /ai/*` → `AiAnalysis` row created (`PENDING`) + BullMQ job → worker calls FastAPI → row updated (`COMPLETED`/`FAILED`) + `ai.completed` notification (→ realtime `notification.created`).

### Initiating endpoints (all protected, all **async** — return immediately with an id)
- `POST /ai/cv/analyze` — `{ "resumeId": "cuid" }` → `201 { analysisId }` (resume must belong to the caller)
- `POST /ai/cv/generate` — no body → `201 { analysisId }` (uses the caller's profile)
- `POST /ai/match` — `{ "jobId": "cuid" }` → `201 { analysisId }`
- `POST /ai/cover-letter` — `{ "jobId": "cuid" }` → `201 { analysisId }`
- `POST /ai/interview` — `{ "jobId": "cuid" }` → `201 { analysisId }`

### Result polling
- `GET /ai/analyses?page&limit` — the caller's analyses (paginated)
- `GET /ai/analyses/:id` — `200` only for the owner (`403` otherwise):
  ```jsonc
  { "id": "...", "userId": "...", "type": "CV_ANALYZE", "status": "COMPLETED",
    "inputReference": { "resumeId": "..." }, "output": { ... }, "scores": { ... },
    "metadata": { ... }, "error": null, "createdAt": "...", "completedAt": "..." }
  ```
- **`status` values:** `PENDING → PROCESSING → COMPLETED | FAILED`. `error` is populated on failure.
- **Polling strategy:** poll `GET /ai/analyses/:id` every 2–3 s until `COMPLETED`/`FAILED`, or subscribe to `notification.created` and react to `type === "ai.completed"` (payload `data.analysisId`). AI jobs have `attempts: 4` with backoff, so failures may resolve on retry — surface `error` and offer "retry" (re-POST).

### Per-type output shapes (from the FastAPI contracts)
- **CV_ANALYZE** — `output`: `{ overall_score: number, strengths: string[], weaknesses: string[], missing_skills: string[], ats_compatibility: number, improvement_suggestions: string[], structure_quality: string, keyword_recommendations: string[] }`; `scores`: `{ overall, ats }`
- **MATCH** — `output`: `{ skill_match, experience_match, location_match, seniority_match, overall_match (0–100), reasoning: string }`; `scores`: `{ skill, experience, location, seniority, overall }`
- **CV_GENERATE** — `output`: `{ cv_markdown: string }`
- **COVER_LETTER** — `output`: `{ cover_letter: string }`
- **INTERVIEW** — `output`: `{ questions: string[] }`
- `CV_TAILOR` and `JOB_ANALYZE` exist in the database enum but are **not exposed via the API** (the worker marks them `FAILED: "not yet exposed via API"`) — do not build UI for them.

### CV text extraction
Happens automatically after CV upload (`processingStatus` on the resume: `PENDING → COMPLETED | FAILED`). Text files are parsed in-process; PDF/DOCX go through the AI service. The frontend should display the resume `processingStatus` and allow applying with a CV regardless (only `COMPLETED` CVs have extracted text used by AI analysis).

---

## 11. Billing

Base paths `/api/v1/plans` and `/api/v1/subscriptions`. Plans list is public; subscription endpoints are protected. **Webhook is server-to-server only — the frontend never calls it and never confirms payments.**

### Plans — `GET /api/v1/plans?type=CANDIDATE|COMPANY` (public)
Seeded plans:

| type | name | price (USD) | billingInterval | features (exact keys) |
| --- | --- | --- | --- | --- |
| CANDIDATE | FREE | 0 | MONTHLY | `cv.uploads: 3`, `ai.*: false`, `applications: 10000` |
| CANDIDATE | PRO | 999¢ | MONTHLY | `cv.uploads: 20`, `ai.cv_analyze/cv_generate/match/cover_letter/interview: true` |
| COMPANY | TRIAL | 0 | MONTHLY | `team.members: 5`, `activeJobs: 3`, `ai.enabled/automation.enabled/assessments.enabled/analytics.enabled: false`, `billing.manage: true` |
| COMPANY | BUSINESS | 4900¢ | MONTHLY | `team.members: 20`, `activeJobs: 20`, `automation.enabled/assessments.enabled/analytics.enabled: true` |
| COMPANY | PRO | 9900¢ | MONTHLY | `team.members: 50`, `activeJobs: 999`, `ai.enabled/automation.enabled/assessments.enabled/analytics.enabled: true` |
| COMPANY | ENTERPRISE | 29900¢ | MONTHLY | `team.members: 1000`, `activeJobs: 99999`, all features `true` |

Response item: `{ id, name, type, priceCents, currency, billingInterval, active, features: {...}, sortOrder, createdAt, updatedAt }`. The frontend can render feature checklists from the `features` JSON.

### Current subscription — `GET /subscriptions/me?ownerType=CANDIDATE|COMPANY&companyId=...`
- Candidate: `ownerType=CANDIDATE` (no companyId). Company: `ownerType=COMPANY&companyId=<id>` (requires tenant `billing.manage`).
- Response:
  ```jsonc
  // No active subscription → default free plan is reported
  { "plan": { "id": "...", "name": "FREE", /* ...plan DTO... */ }, "subscription": null }
  // Active subscription
  { "plan": { "...": "PRO" },
    "subscription": { "id": "...", "ownerType": "CANDIDATE", "planId": "...", "provider": "dev",
      "status": "ACTIVE", "currentPeriodStart": "...", "currentPeriodEnd": "...", "canceledAt": null,
      "createdAt": "...", "payments": [ { "id": "...", "amountCents": 999, "currency": "USD", "status": "SUCCEEDED", "createdAt": "..." } ] } }
  ```
- `subscription.status`: `PENDING | TRIALING | ACTIVE | PAST_DUE | CANCELED | EXPIRED`.

### Checkout — `POST /subscriptions/checkout` (protected)
```jsonc
{ "planId": "cuid", "ownerType": "CANDIDATE", "companyId": "optional for COMPANY" }
// 201
{ "checkoutUrl": "https://.../checkout/...", "providerReference": "dev_session_..." }
```
- Free plans → `400 "This plan is free and does not require checkout"`.
- Creates a `PENDING` subscription reference. **Activation happens only via the webhook** — the frontend redirects the user to `checkoutUrl` and then **polls `GET /subscriptions/me`** (or listens for `subscription.activated`) to detect activation; it must not optimistically flip to paid.
- The `dev` provider returns `<FRONTEND_URL>/payments/checkout?ref=...` — a frontend page can read `ref` and (in dev) POST the matching webhook event, but production flows rely on the provider's hosted checkout.
- Frontend routes referenced by the backend: `/payments/success`, `/payments/cancel` (from `FRONTEND_URL`).

### Cancel — `POST /subscriptions/cancel` (protected)
`{ "subscriptionId": "cuid" }` → `201 { success: true, message: "Subscription will be canceled at the end of the current period" }`. Owner-only (candidate owner, or company `billing.manage`); `403` otherwise.

### Webhook (server-to-server) — `POST /subscriptions/webhook`
Signature-verified (`x-webhook-secret` for the dev provider, `stripe-signature` for Stripe). Events handled: `checkout.session.completed`, `invoice.paid`, `subscription.created` (→ `ACTIVE` + `subscription.activated` notification + Payment row `SUCCEEDED`), `invoice.payment_failed` (→ `PAST_DUE` + `payment.failed`), `subscription.canceled` (→ `CANCELED`), `subscription.updated` (period changes). **The frontend should react to the resulting notification/realtime events and `/subscriptions/me` polling.**

### Limits & entitlement behavior (what the UI must handle)
- Exceeding a plan limit returns `403` with a message like `Company plan limit reached for "team.members" (5/5). Upgrade your plan to increase this limit.` — surface this as an "upgrade" CTA.
- Enforced today: `team.members` (invites count active members + pending invitations) and `activeJobs` (jobs in DRAFT/PENDING_APPROVAL/APPROVED/PUBLISHED). Candidate `cv.uploads` limit on resume uploads.

---

## 12. Assessments

Base path `/api/v1`. Company side requires tenant `assessment.manage` (COMPANY_ADMIN/PLATFORM_ADMIN); candidate side is self-service via invitation token.

### Company side
- `POST /companies/:companyId/assessments` — `{ title, description?, type: "SKILL|BEHAVIORAL|TECHNICAL", durationMinutes?, status?: "DRAFT|ACTIVE|ARCHIVED", questions?: [{ prompt, type: "MULTIPLE_CHOICE|TEXT|CODING", options?: [{label,value}], correctAnswer?, points?, order? }] }` → `201` full assessment incl. questions
- `GET /companies/:companyId/assessments?page&limit` → paginated `{ items, page, limit, total, totalPages }` (with `_count.questions`, `_count.invitations`)
- `GET /companies/:companyId/assessments/:assessmentId` → assessment + questions
- `PATCH /companies/:companyId/assessments/:assessmentId` — updatable fields: title, description, type, durationMinutes, status
- `DELETE /companies/:companyId/assessments/:assessmentId` → `{ success: true }`
- `POST /companies/:companyId/assessments/:assessmentId/invitations` — `{ "candidateId": "candidateProfileId", "expiresAt?": "ISO" }` → `201 { invitationId, token, expiresAt }` — **the raw `token` is returned to the company** so it can send it to the candidate (e.g. by email or copy-paste); the candidate also receives an `assessment.invited` notification.
- `GET /companies/:companyId/assessments/:assessmentId/invitations` → list with candidate + attempt info

### Candidate side
- `POST /assessments/attempts/start` — `{ "token": "<raw invitation token>" }` → `200`
  ```jsonc
  { "attemptId": "...", "startedAt": "...",
    "questions": [ { "id": "...", "prompt": "...", "type": "MULTIPLE_CHOICE",
                     "options": [{ "label": "O(log n)", "value": "O(log n)" }], "points": 2, "order": 0 } ],
    "durationMinutes": 30 }
  ```
  - `MULTIPLE_CHOICE` questions include `options`; TEXT/CODING questions expose no options. **`correctAnswer` is never sent to the candidate.**
  - Token is single-use per candidate (email must match the invitation's candidate); expired/completed → `400`.
- `POST /assessments/attempts/:attemptId/submit` — `{ "answers": [{ "questionId": "...", "answer": "..." }] }` → `200 { attemptId, score, maxScore, status: "COMPLETED" }`
  - Scoring: `MULTIPLE_CHOICE` with a correct answer is auto-scored; TEXT/CODING get `0` auto points (manual review) — the UI should label these "awaiting review".
  - Single submission — re-submitting → `400 "Assessment already submitted"`.
- `GET /assessments/attempts/:attemptId` — attempt + answers + question details (candidate owner or company `assessment.manage`).

---

## 13. Analytics

**No date-range or arbitrary filters exist** — the metrics are computed over all-time (plus a 7-day window where noted). Company metrics are cached 5 minutes, platform metrics 60 seconds, and are invalidated on key events (application created/status change, job publish) via a background queue.

### `GET /api/v1/analytics/company/:companyId` (tenant `analytics.view`)
```jsonc
{ "companyId": "...", "activeJobs": 1, "totalJobs": 5, "totalApplications": 42,
  "applicationsLast7Days": 7,
  "applicationsByStatus": { "APPLIED": 10, "SCREENING": 8, "SHORTLISTED": 6,
                            "ASSESSMENT": 4, "INTERVIEW": 4, "OFFER": 2, "HIRED": 1,
                            "REJECTED": 5, "WITHDRAWN": 2 },
  "screeningRate": 57.1, "interviewRate": 14.3, "offerRate": 4.8, "hireRate": 2.4,
  "hires": 1, "avgTimeToHireDays": 12.5, "interviewsScheduled": 3 }
```
- Rates are percentages (0–100, one decimal). `avgTimeToHireDays` is `null` until a hire occurs. `applicationsByStatus` only contains statuses with ≥ 1 application.
- **Recommended visualizations:** funnel (by status), KPI cards (activeJobs, applications, hireRate, avgTimeToHire), 7-day application trend (poll/recompute client-side from `applicationsLast7Days` or the applications list).

### `GET /api/v1/admin/analytics` (PLATFORM_ADMIN + `admin.analytics`)
```jsonc
{ "users": 120, "candidates": 96, "companies": 15, "verifiedCompanies": 12, "jobs": 88,
  "applications": 320, "hires": 18, "activeSubscriptions": 9,
  "revenueByCurrencyCents": { "USD": 44100 },
  "aiUsage": { "COMPLETED": 40, "FAILED": 2, "PENDING": 1, "PROCESSING": 0 } }
```
- Recommended: platform dashboard KPI cards + revenue chart (cents per currency) + AI usage by status.

---

## 14. Admin (PLATFORM_ADMIN only)

All endpoints under `/api/v1/admin/*` are `@Roles(PLATFORM_ADMIN)` **plus** a permission. The admin user is granted `PLATFORM_ADMIN` by an administrator directly in the database (seeded account: `admin@startupstarter.test` / `Password123!` in dev).

| Endpoint | Permission | Purpose |
| --- | --- | --- |
| `GET /admin/users?page&limit&search&status` | `admin.users` | paginated users (with roles) |
| `GET /admin/users/:id` | `admin.users` | user + roles + memberships |
| `PATCH /admin/users/:id` `{ status?, email? }` | `admin.users` | suspend/activate, change email (cannot suspend self → `400`) |
| `PATCH /admin/users/:id/roles` `{ roleNames: string[] }` | `admin.users` | replace all roles (unknown names → `400`) |
| `GET /admin/roles` | `admin.users` | all roles with permissions |
| `GET /admin/permissions` | `admin.users` | all permissions |
| `GET /admin/companies?page&limit&status&search` | `admin.companies` | companies + member/job counts |
| `GET /admin/jobs?page&limit&status&search` | `admin.jobs` | jobs + company + application counts |
| `POST /admin/jobs/:id/approve` | `admin.jobs` | approve (from `PENDING_APPROVAL`) |
| `POST /admin/jobs/:id/reject` `{ reason }` | `admin.jobs` | reject with reason |
| `GET /admin/verifications?page&limit&status` | `admin.verifications` | company verifications + documents metadata |
| `GET /admin/verifications/:id` | `admin.verifications` | detail (incl. registration identifier, docs metadata — **documents are private; no download endpoint exists**) |
| `POST /admin/verifications/:id/approve` | `admin.verifications` | approve → company `ACTIVE` |
| `POST /admin/verifications/:id/reject` `{ reason }` | `admin.verifications` | reject with reason |
| `GET /admin/subscriptions?page&limit` | `admin.subscriptions` | subscriptions + plan + owner |
| `GET /admin/audit-logs?page&limit&action&entityType&actorId` | `admin.audit` | paginated audit log (actor name/email, metadata, ip, userAgent) |
| `GET /admin/analytics` | `admin.analytics` | platform metrics (§13) |

**Separation:** company-level "admin" work (team, jobs, billing, automation, assessments) happens under the company's own endpoints with tenant roles; `/admin/*` is exclusively platform-level. Audit-log actions you can filter on (examples): `application.status_changed`, `job.approved`, `company_verification.approved`, `auth.login`, `team.invitation_sent`, `billing.checkout_started`.

---

## 15. File / Storage System

### Upload requirements (all upload endpoints)
- **Field name:** `file` (multipart/form-data). A missing field → `400` (resumes) or `{ error: "A file is required (field \"file\")" }` (verification docs).
- **Max size:** 10 MB (enforced by the multer interceptor *and* the validator).
- **Allowed MIME types:** `application/pdf`, `application/msword` (doc), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `text/plain`, `text/markdown`, `image/png`, `image/jpeg`, `image/webp`.
- **Allowed extensions:** `.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.webp`.
- **Content check:** PDF/PNG/JPEG are magic-byte validated; mismatched content → `400 "File content does not match its declared type"`.
- Other errors: `400` for disallowed extension/type, empty file, or size > 10 MB.

### Upload endpoints
- CVs: `POST /api/v1/candidates/me/resumes` (§5).
- Company verification documents: `POST /api/v1/companies/:companyId/verification/documents` (§4). No public/profile-image upload endpoint exists yet — do not build one against a non-existent API.

### Downloads (signed URLs)
- CV download is **never a raw GET on the object**: call the authorization endpoint that returns `{ url, filename }`, then fetch/redirect the URL.
  - Candidate: `GET /candidates/me/resumes/:id/download`
  - Company (via application): `GET /applications/:id/cv` — requires `application.view` **and** an application link; every access is audit-logged.
  - Direct resume download URL is a **security test case**: a company calling `/candidates/me/resumes/:id/download` on another candidate's CV gets `403` (§16 security tests).
- The returned `url` is:
  - **local provider (dev/test):** `/api/v1/files/signed?key=<base64url>&expires=<epoch>&sig=<hmac>` — fetch it with `credentials` not required (it's `@Public` but signature-gated; wrong/expired sig → `403`). Serves the file inline with a content-type derived from the extension.
  - **s3 provider (production):** a presigned S3 URL (15 min default).
- Files are stored privately server-side; there is no public listing.

---

## 16. Error Handling

### Canonical error body (global exception filter)
```jsonc
{ "statusCode": 400, "message": "Human-readable message", "error": "Bad Request",
  "requestId": "-", "path": "/api/v1/...", "timestamp": "ISO" }
```
- Validation errors: `message` is a single string (rules joined with `", "`). `forbidNonWhitelisted` means **unknown body properties return `400`** (`property role should not exist`) — never send extra fields.
- Prisma errors are mapped: unique violation → `409`, missing record → `404`, FK violation → `409`.

| Status | Meaning (as implemented) | Frontend action |
| --- | --- | --- |
| `400` | Validation / bad input / invalid transition / duplicate apply / expired token / free-plan checkout / wrong file type | Show `message` inline; keep form data; for `"property X should not exist"` fix the payload shape |
| `401` | Missing/invalid/expired/tampered access token, wrong credentials, suspended account, reuse of rotated refresh token, bad webhook signature | Attempt refresh once (single-flight) then retry; on failure → `/login` |
| `403` | Role/permission/tenant denied, unverified email, company context missing, candidate profile not visible, entitlement limit reached | Show permission/upgrade message; verify the active company + role; limits → billing CTA |
| `404` | Resource not found — also used to **hide non-public jobs** and unknown entities | Show "not found"; for jobs check company membership before assuming deletion |
| `409` | Unique conflict (e.g. already applied, duplicate invite, delete job with applications) | Show message; refresh list |
| `429` | Throttled (auth: 10/min; global: 120/min default, disabled in tests) | Backoff and retry; show "too many requests" |
| `500` | Unexpected error (also `"Custom Id cannot contain :"`-style queue misconfigs — should not occur in normal operation) | Show generic error; log `requestId` |

Statuses the backend never emits (do not special-case): there is **no `422`** — validation always maps to `400`. `204` is used for logout only; success responses are `200`/`201`.

---

## 17. Pagination / Search / Filtering

**Uniform pagination contract** (`src/common/utils/pagination.ts`) — used by jobs search, company jobs, applications lists, notifications, AI analyses, admin lists, automation executions, assessments:
- Request: `?page=<int ≥ 1>&limit=<int 1–100>` (default `page=1&limit=20`).
- Response:
  ```jsonc
  { "items": [ ... ], "page": 1, "limit": 20, "total": 132, "totalPages": 7 }
  ```
- No cursors anywhere. `totalPages` is always ≥ 1.
- Unpaginated lists (exact): `/candidates/me/resumes`, `/candidates/me/saved-jobs`, `/companies/me/list`, `/companies/:id/members`, invitations list, `/interviews/applications/:applicationId`, `/applications/:id/events`, `/applications/:id/notes`, `/candidates/me` (profile), assessment invitations list, `/plans`.
- Search/filter params per list:
  - Jobs search: §6 table. `skills` is comma-separated in the query string.
  - Company jobs: `status` (JobStatus).
  - Company applications: `status` (ApplicationStatus) + `jobId`.
  - My applications: `status`.
  - Notifications: `unreadOnly=true`.
  - Admin users/companies/jobs: `search` (name/email or name/title), `status`.
  - Audit logs: `action`, `entityType`, `actorId`.
  - Plans: `type`.
  - Subscriptions me: `ownerType` (required) + `companyId` (required for COMPANY).

---

## 18. Frontend Route Map (Next.js proposal)

Legend: `role` = platform role required; `perm` = permission required (tenant role). Company-scoped pages resolve the company from the URL param.

| Route | Required | API used |
| --- | --- | --- |
| `/login` | public | POST /auth/login |
| `/register` | public | POST /auth/register |
| `/verify-email` | public | POST /auth/verify-email |
| `/forgot-password` | public | POST /auth/forgot-password |
| `/reset-password` | public | POST /auth/reset-password |
| `/invitations/accept` | authenticated | POST /company-invitations/accept |
| `/jobs` | public | GET /jobs |
| `/jobs/:id` | public | GET /jobs/:id |
| `/candidate/profile` | CANDIDATE | GET/PATCH /candidates/me, skills/experiences/education |
| `/candidate/cvs` | CANDIDATE | /candidates/me/resumes* |
| `/candidate/saved` | CANDIDATE | /candidates/me/saved-jobs |
| `/candidate/applications` | CANDIDATE | GET /applications/me |
| `/candidate/ai` | CANDIDATE (PRO features flagged by entitlements) | /ai/* |
| `/candidate/subscription` | CANDIDATE | /plans, /subscriptions/* |
| `/candidate/assessments/attempt/:token` | CANDIDATE | /assessments/attempts/start, submit |
| `/company/:companyId/dashboard` | tenant `analytics.view` | /analytics/company/:id, /jobs/company/:id |
| `/company/:companyId/jobs` | tenant `job.create`/`job.update` | /jobs, /jobs/company/:id |
| `/company/:companyId/jobs/new` | tenant `job.create` | POST /jobs |
| `/company/:companyId/jobs/:jobId` | tenant `job.update` | /jobs/:id, submit/publish/close |
| `/company/:companyId/applications` | tenant `application.view` | /companies/:id/applications |
| `/company/:companyId/applications/:applicationId` | tenant `application.view` | /applications/:id, status, events, notes, cv |
| `/company/:companyId/candidates/:profileId` | tenant `candidate.view` | GET /candidates/:profileId |
| `/company/:companyId/interviews` | tenant `interview.create` | /interviews |
| `/company/:companyId/team` | tenant `team.view` | /companies/:id/members |
| `/company/:companyId/team/invite` | tenant `team.invite` | /companies/:id/invitations |
| `/company/:companyId/settings` | tenant `team.manage` | PATCH /companies/:id, /verification* |
| `/company/:companyId/billing` | tenant `billing.manage` | /plans, /subscriptions/* |
| `/company/:companyId/automation` | tenant `automation.manage` | /companies/:id/automation/* |
| `/company/:companyId/assessments` | tenant `assessment.manage` | /companies/:id/assessments* |
| `/company/:companyId/analytics` | tenant `analytics.view` | /analytics/company/:id |
| `/payments/success`, `/payments/cancel` | authenticated | (redirect targets from checkout; poll /subscriptions/me) |
| `/admin` (users, companies, verifications, jobs, subscriptions, audit, analytics, roles) | PLATFORM_ADMIN | /admin/* |

`/` should redirect based on `/auth/me` roles/memberships: candidates → `/candidate/profile`, company members → first membership's dashboard, admins → `/admin`.

---

## 19. Frontend State / Data Strategy

Recommended architecture for Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui:

- **Auth state:** a small auth store (Zustand or React Context) holding `{ user, accessToken, status }` in memory. Persist **nothing sensitive**; optionally persist a "last email" for convenience. `status`: `loading | authenticated | unauthenticated | suspended`.
- **Hydration:** a server component/layout calls `GET /auth/me` (with cookie credentials via a server-side fetch) to seed the store; client-side the API client guards with an in-memory token.
- **Current company:** a `company` slice with `companies` (from `/companies/me/list`), `activeCompanyId`; persist the active company in a cookie/localStorage (it's public data). All company-scoped fetches read `activeCompanyId` and pass the route param or `X-Company-Id`.
- **Permissions:** derive from `user.roles` (platform) + `activeCompanyRole` (tenant) using a small constant table mirroring §3. **Do not trust the table alone** — the API enforces and returns `403`.
- **Server state:** use TanStack Query with:
  - Query keys namespaced by entity + company, e.g. `['applications', companyId, { status, page }]`.
  - `staleTime` 30 s for lists, `0` for detail/edit views; mutations invalidate the relevant keys.
  - Polling: AI analyses (2–3 s while PENDING/PROCESSING), `/subscriptions/me` after checkout redirect.
- **Realtime:** one Socket.IO connection per authenticated session; store the socket in a singleton module; a `useNotifications` hook consumes `notification.created` into a query-cache upsert (so the bell badge stays consistent with `/notifications/me`). Invalidate affected queries on domain events (`application.updated`, `candidate.moved`, `interview.updated`).
- **Forms:** react-hook-form + zod; mirror DTO validation (required/optional, lengths, enums) so users get instant feedback; strip unknown fields (backend rejects them).
- **File uploads:** axios/fetch `FormData` with `file` key; show `processingStatus` on resumes; disable submit until `COMPLETED` only if the flow needs extracted text (application can attach any uploaded CV).
- **Error handling:** a central fetch wrapper normalizes the backend error body into `{ statusCode, message }`; a toaster shows `message`; `requestId` is logged for support.

---

## 20. API Client Specification

```
lib/api/
  client.ts        # fetch wrapper: base URL, credentials:include, auth header,
                   #   X-Request-Id, single-flight 401 refresh+retry, error normalization
  auth.ts          # register, login, logout, refresh, verify-email, resend-verification,
                   #   forgot-password, reset-password, me
  users.ts         # users/me, admin users CRUD + roles
  companies.ts     # companies CRUD, me/list, members, verification
  invitations.ts   # invite, list, revoke, accept
  candidates.ts    # profile, skills, experiences, education, saved jobs, preferences, company view
  resumes.ts       # upload, list, setPrimary, remove, download
  jobs.ts          # search, detail, company list, create/update/submit/publish/close/delete
  applications.ts  # apply, mine, company list, detail, status, events, notes, cv
  interviews.ts    # create, get, list-for-application, update
  notifications.ts # list, read, read-all, remove
  ai.ts            # analyze/generate/match/cover-letter/interview, analyses list/get
  billing.ts       # plans, current subscription, checkout, cancel
  assessments.ts   # company CRUD + invitations, candidate start/submit/attempt
  automation.ts    # rules CRUD, executions
  analytics.ts     # company metrics, admin metrics
  admin.ts         # admin users/companies/jobs/verifications/subscriptions/audit-logs/roles/permissions
  ws.ts            # socket.io singleton + typed event subscription
```
Every module exports typed functions returning typed data (see §21). No module should read/write tokens itself — it goes through `client.ts`.

---

## 21. TypeScript Types

**Recommended: generate types from the OpenAPI spec** (Swagger is complete for request/response shapes — every controller is documented with `@ApiTags`/`@ApiProperty` and the document is served at `/docs`).

- Generation: use `openapi-typescript` or `orval`:
  ```bash
  npx openapi-typescript http://localhost:3000/docs-json -o lib/api/schema.d.ts
  ```
  (NestJS serves the raw JSON document at `/docs-json` alongside the UI at `/docs`.)
- Regenerate whenever the backend changes and re-export domain aliases in each `lib/api/*.ts` module.

**Key hand-written types to define** (stable shapes worth explicit typing even with generation):
```ts
type ID = string;
type Role = 'PLATFORM_ADMIN' | 'COMPANY_ADMIN' | 'HR' | 'RECRUITER' | 'HIRING_MANAGER' | 'INTERVIEWER' | 'CANDIDATE';
type MemberRole = Exclude<Role, 'PLATFORM_ADMIN' | 'CANDIDATE'>;
type UserStatus = 'ACTIVE' | 'SUSPENDED';
type CompanyStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';
type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
type CandidateVisibility = 'PUBLIC' | 'RECRUITERS_ONLY' | 'PRIVATE';
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
type ExperienceLevel = 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE';
type JobStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'EXPIRED' | 'CLOSED' | 'REJECTED';
type ApplicationStatus = 'APPLIED' | 'SCREENING' | 'SHORTLISTED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
type InterviewType = 'PHONE' | 'VIDEO' | 'ONSITE' | 'TECHNICAL';
type InterviewStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
type PlanType = 'CANDIDATE' | 'COMPANY';
type SubscriptionStatus = 'PENDING' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
type AiAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type AiAnalysisType = 'CV_ANALYZE' | 'CV_GENERATE' | 'CV_TAILOR' | 'JOB_ANALYZE' | 'MATCH' | 'COVER_LETTER' | 'INTERVIEW';
type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type AssessmentStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type QuestionType = 'MULTIPLE_CHOICE' | 'TEXT' | 'CODING';
type AutomationTriggerType = 'CANDIDATE_APPLIED' | 'APPLICATION_STATUS_CHANGED' | 'CANDIDATE_MATCH_SCORE_UPDATED' | 'INTERVIEW_SCHEDULED' | 'JOB_EXPIRING';

interface Paginated<T> { items: T[]; page: number; limit: number; total: number; totalPages: number; }
interface MeUser { id: ID; name: string; email: string; phone: string | null; status: UserStatus;
  emailVerified: boolean; lastLoginAt: string | null; createdAt: string; roles: Role[];
  candidateProfileId: ID | null;
  memberships: Array<{ companyId: ID; companyName: string; companySlug: string;
    companyStatus: CompanyStatus; role: MemberRole }>; }
interface AuthSession { accessToken: string; user: MeUser; }
// + Company, Job, Application, Resume, Notification, Interview, Plan, Subscription,
//   AiAnalysis, Assessment, AssessmentQuestion, AssessmentAttempt, AutomationRule, ... — all in schema.d.ts
```

---

## 22. Frontend Implementation Order

1. **Phase 1 — Auth:** API client (`client.ts`), register/login/logout/refresh/verify/reset flows, in-memory token store, single-flight 401 handling, route guards.
2. **Phase 2 — Layouts/navigation/RBAC:** `/auth/me` hydration, company switcher (`/companies/me/list` + `X-Company-Id`), role-based nav, error pages.
3. **Phase 3 — Candidate:** profile, skills, experiences, education, job preferences, saved jobs.
4. **Phase 4 — CVs:** upload (10 MB, validated), list, primary, delete, download, processing status.
5. **Phase 5 — Companies:** create, settings, verification documents + submit, members, invitations (send/accept page), role/remove.
6. **Phase 6 — Jobs:** public search/list/detail (all filters + pagination), company job CRUD + submit/publish/close, moderation statuses UI.
7. **Phase 7 — Applications/pipeline:** apply, candidate history, company pipeline board (view/move/notes/history/CV), withdraw.
8. **Phase 8 — Interviews:** schedule, list, update/cancel, calendar UI.
9. **Phase 9 — Notifications + realtime:** REST endpoints, Socket.IO connection + rooms, badge, live updates.
10. **Phase 10 — AI:** trigger operations, polling state UI, results rendering, entitlement gating.
11. **Phase 11 — Billing:** plans page, current subscription, checkout redirect + polling, cancel, limit banners (403 → upgrade).
12. **Phase 12 — Assessments:** company authoring + invitations; candidate attempt experience (timer, submit, score).
13. **Phase 13 — Automation:** rule builder (trigger/conditions/actions per the DTO shape) + executions log.
14. **Phase 14 — Analytics:** company dashboard (funnel/KPIs); admin platform dashboard.
15. **Phase 15 — Admin:** users (suspend/roles), companies, verifications (approve/reject), jobs moderation, subscriptions, audit logs.

Dependency notes: Auth → everything. Candidate profile before CVs before applications. Company before jobs. Jobs before applications before interviews. Billing (entitlements) can come late because limits are enforced server-side; AI needs CVs + jobs; automation depends on the event payloads from §7/§8.

---

## 23. Security Requirements for the Frontend

- **Tokens:** keep the access token **in memory only** (never localStorage/sessionStorage — XSS risk); the refresh token is httpOnly so it never touches JS. Re-issue on refresh; never log tokens.
- **XSS:** React escapes by default; do not use `dangerouslySetInnerHTML` on AI outputs or job descriptions without sanitization (AI-generated CV markdown/cover letters are untrusted — render markdown with an allow-listed sanitizer).
- **CSRF:** refresh cookie is `SameSite=Lax` + httpOnly; still send `credentials: 'include'` explicitly and rely on CORS allow-list (the API rejects cross-origin credentials). No CSRF token endpoint exists — do not invent one.
- **Uploads:** validate client-side (10 MB, allowed type list from §15) as UX only — the server enforces. Never construct file URLs manually.
- **Permission checks:** gate UI by role matrix (§3) but treat `403` as authoritative; never hide data based only on the UI.
- **IDOR:** always use the authenticated user's ids from `/auth/me` (candidateProfileId, memberships) rather than user-supplied ids; tenant routes always carry the verified company context.
- **Secrets:** never ship `JWT_*`, S3 keys, `AI_API_KEY`, `OPENAI_API_KEY`, `DEV_WEBHOOK_SECRET`, `STRIPE_*` to the browser. Only `NEXT_PUBLIC_*` values from §1 are public.
- **Payments:** never call `/subscriptions/webhook`; never mark a subscription active from the UI — poll `/subscriptions/me` / react to notifications.
- **AI:** the frontend calls only `/ai/*`; the AI service is unreachable from the browser (and its URL/keys are backend-only).
- **Signed URLs:** treat them as bearer tokens — don't log them, don't cache them longer than the expiry (15 min / 900 s), and don't embed them in emails.
- **Route protection:** server-side (middleware) + client-side guards; redirect unauthenticated to `/login`, suspended users to a notice, non-members away from tenant routes.

---

## 24. Integration Test Checklist

Backend test suites that already cover these flows: `test/e2e/auth.e2e-spec.ts` (16), `test/e2e/flow.e2e-spec.ts` (17), `test/e2e/security.e2e-spec.ts` (11), `test/e2e/billing.e2e-spec.ts` (8), `test/e2e/ai.e2e-spec.ts` (5). The frontend checklist (mirror them in Playwright):

- [ ] Register candidate → verification email → verify → `/auth/me` shows CANDIDATE + candidateProfileId
- [ ] Login with wrong password / unknown email → identical 401 message
- [ ] Refresh session (cookie + body), reuse old refresh token → 401
- [ ] Logout → refresh token revoked
- [ ] Forgot/reset password → old password fails, new works, all sessions revoked
- [ ] Create company → PENDING_VERIFICATION → upload doc → submit → UNDER_REVIEW → admin approve → ACTIVE + company.verified notification
- [ ] Invite HR → accept via token (email match enforced) → HR sees company + correct role
- [ ] Remove member / change role (last-admin guard)
- [ ] Create job (DRAFT) → submit → admin approve → publish → visible in public search
- [ ] Job edit blocked when PUBLISHED; delete blocked when it has applications (409)
- [ ] Job plan limit: TRIAL 4th active job → 403
- [ ] Search filters: keyword, location, remote, employmentType, experienceLevel, salary, skills (comma), companySlug, sort, pagination
- [ ] Candidate uploads CV → processingStatus COMPLETED; sets primary; multiple versions
- [ ] Candidate saves job; applies (with CV + motivation); duplicate apply → 400
- [ ] Company pipeline: view applications, move APPLIED→SCREENING→SHORTLISTED→INTERVIEW, backward move → 400, notes + events recorded, withdraw by candidate
- [ ] Company downloads candidate CV via application (audit-logged); direct CV download by another company → 403
- [ ] Candidate profile visibility: company without application link → 403 unless PUBLIC
- [ ] Schedule interview → candidate notified (DB + realtime); update → interview.updated; cancel
- [ ] Notifications REST (list/read/read-all/delete) + `notification.created` socket event
- [ ] AI: CV analyze → PENDING→COMPLETED with overall_score; match with scores; cover letter; generate; other user's analysis → 403
- [ ] Billing: plans list; candidate FREE default; checkout → webhook activates PRO → subscription.activated; payment_failed → PAST_DUE; cancel (owner only)
- [ ] Team size limit: TRIAL 5th invite → 403
- [ ] Assessment: create with MC questions → invite → candidate start (no correctAnswer leaked) → submit → auto-score MC
- [ ] Automation: rule created; executions logged (verify via executions list)
- [ ] Analytics company + admin endpoints; admin audit-logs filter `application.status_changed`
- [ ] Admin: suspend user → their tokens immediately 401; assign roles; approve/reject verification + jobs
- [ ] Security: candidate on admin endpoints → 403; company A on company B data (applications, jobs, candidates, CVs) → 403/404; header spoofing `X-Company-Id` of another tenant → 403; anonymous on protected routes → 401

---

## 25. Backend Readiness Audit (verified against code)

**Audit performed against every controller, DTO, guard, service, Prisma model, the AI service and the Socket.IO gateway.** Findings and fixes applied during this audit:

- **Fixed — JWT verification without the access secret** in `JwtAuthGuard` (all protected REST routes) and `RealtimeGateway` (Socket.IO handshake). Both now verify with `JWT_ACCESS_SECRET` and `HS256`. Verified by e2e auth/security suites.
- **Fixed — BullMQ custom jobId colon collisions** (`cv:*`, `ai:*`, notification/email dedupe keys) causing 500s on CV upload and company creation. All jobIds/dedupe keys are sanitized (`safeJobId`); verified by flow/billing e2e suites.
- **Fixed — candidate-applied notifications never reached the job creator** when the creator was also a company admin; recipients are now the union of company members + creator, deduplicated.
- **Fixed — tenant-isolated candidate profile access** — companies can only view profiles with an application link unless visibility is `PUBLIC` (security e2e).
- **Fixed — team-size entitlement** now counts active members + pending invitations (billing e2e).
- **Fixed — auth throttling** respects `THROTTLE_ENABLED` so test/e2e suites aren't rate-limited; auth routes still get 10/min brute-force protection in real environments.
- **Fixed — logout** now works with a body refresh token and is public (browser-cookie compatible).
- **No frontend blockers remain.** Known intentional gaps (do not build against them): no profile-image/logo upload endpoint, no candidate-search endpoint, no `CV_TAILOR`/`JOB_ANALYZE` AI endpoints, no verification-document download endpoint, no date-range analytics filters, no `422` error status (validation → 400).

**Final verification (all green):**

| Check | Result |
| --- | --- |
| `npm run lint` | 0 problems |
| `npm run typecheck` | clean |
| `npx prisma validate` | valid; migrations up to date |
| `npm run test:unit` | 48 passed |
| `npm run test:e2e` | 58 passed (auth 16, flow 17, security 11, billing 8, ai 5) |
| `cd ai-service && AI_PROVIDER=rule_based python -m pytest` | 10 passed |
| `npm run build` | production build OK (`dist/main.js`) |
| Swagger `/docs` + `/docs-json` | served (non-production) |
| Health `GET /api/v1/health` | `{ status: "ok", info: { database: up, redis: up } }` |
