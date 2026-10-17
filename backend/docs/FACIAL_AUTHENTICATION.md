# Facial Authentication (Face Login)

Optional biometric sign-in for **Candidates** and **Company users** (owner, HR, team
members). The biometric identity belongs to the **individual User**, never to a
company. Platform administrators keep password-only authentication by design.

> **Status: OPT-IN, OFF by default.** `BIOMETRIC_ENABLED=false` disables enrollment
> and face login entirely (both return 404) and password/email authentication is
> completely unaffected. Turn it on only after validating it in staging.

---

## 1. Architecture

```
Browser (Next.js)
   │  JWT access token (face login only when authenticated session exists)
   │  frames as multipart/form-data (max 5 MB each, JPEG)
   ▼
NestJS API  ── BiometricService ──┬── BiometricController   (enrollment, status, delete)
                                  └── FaceAuthController     (public face login)
   │  authenticated call (X-AI-Key: AI_API_KEY) — frames decoded in memory, discarded
   ▼
FastAPI AI service ── /face/enroll · /face/verify · /face/liveness
   │  OpenCV Haar cascade detection → quality → passive liveness → embedding (128-d)
   ▼
returns { quality, liveness, embedding } to NestJS
   │
   ▼
NestJS encrypts the embedding with AES-256-GCM (BIOMETRIC_ENCRYPTION_KEY)
   ▼
PostgreSQL — BiometricCredential (encrypted template only, never a photo)
```

- The browser **never** talks to FastAPI directly.
- The Python service **never** issues JWTs and never stores frames.
- NestJS alone decides authentication success and issues the session, using the
  same `TokenService` and httpOnly refresh cookie as password login.

## 2. Data model (Prisma)

```prisma
model BiometricCredential {
  id                 String    @id @default(cuid())
  userId             String    @unique
  enabled            Boolean   @default(false)
  encryptedEmbedding String    // AES-256-GCM output: iv:tag:ciphertext (base64)
  algorithmVersion   String    // e.g. "face-cnn-1"
  consentAt          DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  lastUsedAt         DateTime?
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- One active enrollment per user (`@unique` on `userId`); enrolling again upserts.
- `onDelete: Cascade` — deleting the user removes the template with them.
- Raw face images are **never** stored. Frames live only in memory in FastAPI and
  are discarded after processing.

## 3. Encryption at rest

- **Algorithm:** AES-256-GCM (authenticated encryption — tampering is detected).
- **Key:** `BIOMETRIC_ENCRYPTION_KEY`, exactly **64 hex chars (32 bytes)**.
  Generate with `openssl rand -hex 32`.
- The key lives only in the NestJS process env (api + worker). It is never sent to
  the frontend or the AI service, never logged, and never stored in the database.
- **Rotation:** changing the key invalidates all stored templates; users must
  re-enroll. There is no dual-key transition (acceptable for beta).
- **Failure behavior:** a template that cannot be decrypted (wrong key or tampering)
  is treated as a failed verification — it never authenticates and never locks the
  account; password login remains available.

## 4. Enrollment flow

1. `POST /biometric/enroll/start` `{ consent: true }` (authenticated) — returns a
   single-use `enrollmentId` (TTL `FACE_CHALLENGE_TTL_SECONDS`, default 120 s).
   The API rejects `consent !== true` and rejects PLATFORM_ADMIN.
2. The frontend opens the camera (`getUserMedia`), shows a positioning guide, and
   captures **two JPEG frames ~700 ms apart** (the gap feeds the liveness check).
3. `POST /biometric/enroll/verify` (multipart `enrollmentId`, `frame_a`, `frame_b`):
   - challenge must exist, match the user, be unused, and be unexpired;
   - frames must decode and contain **exactly one face**;
   - quality check: sharpness (on the face region), face size, no multiple faces;
   - passive liveness: two faces must overlap (>45 % IoU) but move slightly;
   - embedding generated (128-d, L2-normalized);
   - NestJS encrypts the embedding and upserts the credential (`enabled=true`,
     `consentAt=now`).
4. Audit events: `biometric.enrollment_started`, `biometric.enrollment_completed`,
   `biometric.enrollment_failed`.

Frontend: Settings → Security → Face Login → Enable (consent dialog → camera →
capture → processing → success). Camera frames are downscaled to 480×360 and
compressed to JPEG 0.85 before upload.

## 5. Face login flow

1. `POST /auth/face/start` `{ email }` (public, throttled) — returns a single-use
   `challengeId` (TTL `FACE_CHALLENGE_TTL_SECONDS`). Generic response; never
   reveals whether the account exists or has biometrics enabled.
2. Frontend captures two frames as in enrollment.
3. `POST /auth/face/verify` (multipart `email`, `challengeId`, `frame_a`,
   `frame_b`):
   - challenge validity (exists, matches email, unused, unexpired);
   - frame decode + one face + liveness;
   - user must exist, be ACTIVE, email-verified, and have `enabled` credential;
   - embedding compared with the decrypted stored template via **cosine
     similarity** against `FACE_MATCH_THRESHOLD` (default **0.5**, conservative —
     0 = identical, 1 = orthogonal);
   - on success: NestJS issues the normal access token + rotating httpOnly
     refresh cookie and returns `{ accessToken, user }` — the same session
     machinery as password login. RBAC memberships/roles are loaded exactly the
     same way afterwards.
4. Audit: `biometric.login_success` / `biometric.login_failed` (reason: challenge
   invalid, liveness, mismatch, decrypt failure, not enrolled — never the
   embedding or frames).

Frontend: Login → "Sign in with Face" → email → camera → verified → session.

## 6. Liveness (anti-spoofing)

- **Implementation:** passive, two-frame check. Both frames must contain exactly
  one face, the faces must overlap, and the face must move a little between
  frames. A printed photo yields identical frames → `no_motion` → rejected.
- **Honest limitation:** this is **basic anti-spoofing**, not biometric-grade.
  It does not defeat a video of the victim or a sophisticated 3D mask. It is
  isolated in `ai-service/app/face/liveness.py` so a stronger active/passive model
  (blink challenge, depth) can replace it without touching NestJS.
- `FACE_LIVENESS_ENABLED=false` disables the check (not recommended).

## 7. Matching model

- **Embedding:** OpenCV DNN — OpenFace `nn4.small2.v1.t7` (128-d, L2-normalized),
  a BSD-licensed face-embedding model, CPU-only, ~2 MB download at image build.
- **Metric:** cosine similarity on normalized embeddings.
- **Threshold:** `FACE_MATCH_THRESHOLD` (env), default 0.5.
  - Lower threshold → fewer false rejections (FRR) but more false acceptances
    (FAR). The conservative 0.5 default favors security for authentication.
  - Operators should tune with their own dataset before relying on it as the
    primary auth factor for high-value accounts.
- Provider abstraction in `ai-service/app/face/embedding.py` — a stronger model
  (e.g. dlib / InsightFace, when available on the target Python/Docker platform)
  can be swapped in. dlib currently has no wheel for Python 3.13, so OpenCV DNN
  is the portable default.

## 8. Rate limiting / brute force

- Auth endpoints carry the same strict throttling as password login
  (`AUTH_THROTTLE_LIMIT`, default 10/min per IP).
- `BiometricService` additionally tracks failures per `email+IP` within
  `FACE_ATTEMPT_WINDOW_MS` (default 10 min). After `FACE_MAX_ATTEMPTS` (default 5)
  failures the pair is blocked for `FACE_BLOCK_MS` (default 10 min).
- A block only affects **face login** — password login is never blocked by
  biometric failures, and the account is never permanently locked.
- Challenges are single-use and short-lived → replay is rejected with a fresh-scan
  error; an optional client `nonce` can bind a challenge to one device/session.

## 9. API endpoints (NestJS, prefix `/api/v1`)

| Method | Path                     | Auth       | Purpose                                            |
|--------|--------------------------|------------|----------------------------------------------------|
| GET    | `/biometric/status`      | JWT        | enabled/enrolled/consentAt/lastUsedAt              |
| POST   | `/biometric/enroll/start`| JWT        | consent + single-use enrollment session            |
| POST   | `/biometric/enroll/verify`| JWT       | two frames → encrypted template                    |
| DELETE | `/biometric`             | JWT        | permanently disable + delete template              |
| POST   | `/auth/face/start`       | public     | single-use challenge for face login                |
| POST   | `/auth/face/verify`      | public     | frames + challenge → session (JWT + refresh cookie)|

All return 404 (`Biometric authentication is disabled`) when the feature flag is off.

## 10. Error codes and HTTP status contract (safe user messages)

The AI service returns structured domain codes (`no_face`, `multiple_faces`,
`low_quality`, `blurry`, `face_too_small`, `liveness_failed`, `invalid_image`)
and a separate `processing_error` for internal failures. NestJS preserves the
domain meaning instead of collapsing everything into a generic failure:

| Situation                                  | HTTP | Body message (user-safe)                     |
|--------------------------------------------|------|----------------------------------------------|
| Feature flag off                           | 404  | `Biometric authentication is disabled`       |
| Poor-quality scan (enrollment)             | 400  | `Image quality is too low. …` / `No face …` / `Multiple faces …` |
| Liveness failure (enrollment)              | 400  | `Liveness check failed. Please try again.`   |
| Enrollment session used/expired            | 410  | `Enrollment session expired. Please start again.` |
| Face mismatch / invalid or replayed / expired challenge / not enrolled | 401 | `Face verification failed.` (generic — never reveals account existence or biometric state) |
| Too many failed attempts (email+IP)        | 429  | `Too many attempts. Try again later or use your password.` |
| AI service down / timeout / 5xx            | 503  | `Face login is temporarily unavailable. Please use your password.` |

**Important:** a quality rejection from the AI service (HTTP 422 with a domain
`code`) is a *domain* error and is surfaced as 400 during enrollment or as a
generic 401 during face login — it is **never** converted into 503. Only real
infrastructure failures (connection refused, timeout, AI 5xx, invalid AI key)
produce 503. This contract is enforced by the regression tests in
`test/unit/face-client.spec.ts` (422 `low_quality` → `FaceRejectedError`, not
`FaceServiceUnavailableError`) and `test/unit/biometric.service.spec.ts`.

The backend always maps to generic, user-safe messages and never leaks model
details, the embedding, or the encryption key. The frontend translates each
case (`errorLowQuality`, `errorFaceMismatch`, `errorAiUnavailable`,
`errorChallengeExpired`, `errorTooManyAttempts`) in EN/FR/AR.

## 11. Environment variables

| Variable                    | Default          | Meaning                                   |
|-----------------------------|------------------|-------------------------------------------|
| `BIOMETRIC_ENABLED`         | `false`          | Feature flag (OFF until validated)        |
| `BIOMETRIC_ENCRYPTION_KEY`  | — (required when on) | 64-hex AES-256-GCM key                 |
| `FACE_MATCH_THRESHOLD`      | `0.5`            | Cosine threshold (conservative)           |
| `FACE_LIVENESS_ENABLED`     | `true`           | Passive two-frame liveness                |
| `FACE_MAX_ATTEMPTS`         | `5`              | Failures before temporary block           |
| `FACE_ATTEMPT_WINDOW_MS`    | `600000`         | Failure window                            |
| `FACE_BLOCK_MS`             | `600000`         | Block duration                            |
| `FACE_CHALLENGE_TTL_SECONDS`| `120`            | Challenge lifetime                        |
| `FACE_MAX_IMAGE_BYTES`      | `5242880`        | Max frame size (5 MB)                     |
| `AI_FACE_SERVICE_URL`       | `AI_SERVICE_URL` | FastAPI face router base                  |

## 12. Frontend

- **i18n:** all face-auth strings are centralized in `web/src/lib/i18n/dictionaries.ts`
  (English / French / Arabic). Arabic switches `<html dir="rtl">` automatically.
- **Dark mode:** components use shadcn/Tailwind tokens and render correctly in
  both themes (next-themes `class` strategy).
- **Components:** `FaceCamera`, `FaceEnrollment` (consent wizard), `FaceVerification`
  (login flow), `FaceStatusCard` (Settings → Security).
- Camera handling: permission denied/unavailable/HTTPS-required states, positioning
  guide overlay, retry, and fallback to password.

## 13. Deployment

1. Build the AI image (OpenCV headless + OpenFace model bundled at build).
2. Set `BIOMETRIC_ENABLED=false` (default) for the first deployment.
3. Generate `BIOMETRIC_ENCRYPTION_KEY` and set it identically on api + worker.
4. Validate in staging (enroll, login, wrong-face rejection, disable, password
   fallback) before enabling for real users.
5. The AI service is internal-only (never published); the browser path is
   browser → NestJS → FastAPI.

## 14. Privacy

- Explicit consent is required (`consentAt` is stored; the API rejects enrollment
  without `consent: true`).
- Only an encrypted template is stored — never a photo, stream, or raw frame.
- The user can disable/delete at any time (DELETE `/biometric`), which never locks
  them out (password remains).
- No biometric data in logs, analytics, Socket.IO payloads, JWTs, localStorage,
  cookies, or IndexedDB.
- See `docs/PRIVACY.md` for the full privacy model and the Tunisian
  data-protection review note (production deployment must be reviewed against
  applicable privacy law before enabling biometrics for real users).

## 15. Limitations (honest)

- Basic passive liveness only (defeats printed-photo replay; not video/3D-mask
  resistant).
- OpenFace CNN embeddings are a reasonable baseline, not state-of-the-art;
  threshold tuning is operator responsibility.
- No 1:N identification — face login only verifies against the *specific enrolled
  account* whose email was entered. This is intentional (privacy + security).
- Enrollment is CPU-only and synchronous (~0.5–1 s per call on a 2 vCPU VPS);
  camera upload dominates latency. No GPU required.
