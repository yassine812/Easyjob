# Privacy

This document describes how Startup Starter handles personal data, with a focus on
the facial-authentication (biometric) feature. It is **not** legal advice. A
production deployment that enables biometric authentication for real users MUST be
reviewed against applicable Tunisian data-protection and privacy law (see §7)
before launch.

---

## 1. Data we store

### Account data
- Name, email, phone, password hash (bcrypt), role memberships, and the usual
  account/audit records.
- `lastEmail` on the *client* (localStorage, non-sensitive convenience value).

### Biometric data (face login)
- An **encrypted biometric template** (a 128-dimension face embedding encrypted
  with AES-256-GCM) stored in `BiometricCredential`.
- `consentAt`, `lastUsedAt`, and `enabled` metadata — never the face itself.
- We deliberately do **not** store:
  - raw face photos or camera frames,
  - camera streams,
  - the encryption key (kept in the NestJS process environment only),
  - embeddings in JWTs, cookies, localStorage, IndexedDB, logs, analytics, or
    Socket.IO payloads.

## 2. Consent

Face authentication is **strictly opt-in**:

- The user must tick an explicit consent checkbox before enrollment; the API
  rejects enrollment without `consent: true` and records `consentAt`.
- The enrollment UI explains: the feature is optional, why the data is processed,
  that a template (not a photo) is stored, that it can be disabled/deleted at any
  time, and that password login always remains available.
- No silent enrollment, ever.

## 3. Purpose & processing

- **Purpose:** verifying that the person signing in controls the enrolled account
  (1:1 verification against the account whose email was entered). There is no
  1:N identification and no cross-account matching.
- **Processing location:** camera frames are uploaded to the NestJS API and
  forwarded to the internal FastAPI AI service for detection/embedding. Frames are
  decoded in memory and discarded immediately — nothing is persisted, logged, or
  uploaded to object storage.
- The embedding is returned to NestJS, encrypted, and stored in PostgreSQL.

## 4. Storage & retention

- Biometric templates are encrypted at rest (AES-256-GCM) and stored in the
  application database alongside the account.
- **Deletion:** the user can delete their biometric template at any time
  (Settings → Security → Disable Face Login, or `DELETE /biometric`). Disabling
  never locks the user out — password login is unaffected.
- When a user account is deleted, the template is removed by the database cascade.
- There is currently **no automatic time-based retention** for biometric data;
  retention equals account lifetime unless the user disables the feature. This
  should be reviewed with legal counsel before production use.

## 5. Security

- AES-256-GCM authenticated encryption; the key is a dedicated 64-hex secret
  (`BIOMETRIC_ENCRYPTION_KEY`) never exposed to the frontend, the AI service,
  logs, or API responses.
- Single-use, short-lived challenges prevent replay; per-email/IP failure tracking
  throttles brute force; password login is never blocked by biometric failures.
- Basic passive liveness (two-frame motion check) rejects printed-photo replay.
  It is **not** robust against video replay or 3D masks — see
  `docs/FACIAL_AUTHENTICATION.md` §6 for the honest limitation and §7 for the
  matching/threshold discussion.
- Face login never bypasses RBAC or tenant isolation: after a successful
  verification, the normal user session is created and memberships/roles load
  through the existing authorization pipeline.

## 6. Third-party processing

- The FastAPI AI service runs on our own infrastructure. In the default
  `AI_PROVIDER=rule_based` mode no third-party service is involved in face
  processing.
- If `AI_PROVIDER=openai` is enabled, CV analysis text is sent to OpenAI — this
  does **not** include face data (face processing stays in the local FastAPI
  service; the embedding never leaves our backend).
- Storage providers (S3-compatible) hold application files (CVs, documents) with
  signed-URL access; face data is never uploaded to object storage.

## 7. Tunisian legal review note (IMPORTANT)

> Biometric data is highly sensitive personal data. Before enabling
> `BIOMETRIC_ENABLED=true` for real users, the deployment must be reviewed against
> the applicable legal framework — including Tunisia's data-protection law
> (Law 2004-63 on the protection of personal data and its updates), the work of
> the INPDP (Instance Nationale de Protection des Données Personnelles), and any
> sector-specific rules. This documentation does not constitute legal advice.
>
> Recommended before production:
> - a formal privacy policy and terms covering biometric processing,
> - an updated consent flow reviewed by counsel,
> - a documented retention/deletion policy,
> - a data-processing agreement with any third-party processor,
> - an assessment of whether registration with the INPDP is required.

## 8. Questions / contact

See `docs/FACIAL_AUTHENTICATION.md` for the technical implementation and
`docs/ARCHITECTURE.md` for the system overview.
