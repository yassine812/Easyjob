# Job source capabilities

Evidence review: 2026-09-23. No source is claimed live without configured, authorized access and a successful synchronization. Public vacancy visibility does not grant scraping, storage or redistribution rights.

| Source | Evidence status | Inbound implementation | Application |
|---|---|---|---|
| [APEC](job-sources/apec.md) | REQUIRES_PARTNERSHIP | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Glassdoor](job-sources/glassdoor.md) | NOT_VERIFIED | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Welcome to the Jungle](job-sources/welcome-to-the-jungle.md) | REQUIRES_PARTNERSHIP | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [TanitJobs](job-sources/tanitjobs.md) | REQUIRES_SUBSCRIPTION | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Indeed](job-sources/indeed.md) | REQUIRES_PARTNERSHIP | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [LinkedIn Jobs](job-sources/linkedin.md) | REQUIRES_PARTNERSHIP | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Fabskill](job-sources/fabskill.md) | REQUIRES_API_CREDENTIALS | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [JobReview](job-sources/jobreview.md) | NOT_VERIFIED | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Emploitunisie](job-sources/emploitunisie.md) | NOT_VERIFIED | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Optioncarriere / Careerjet](job-sources/optioncarriere.md) | REQUIRES_API_CREDENTIALS | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |
| [Keejob](job-sources/keejob.md) | NOT_VERIFIED | Licensed gateway implemented; vendor mapping pending | EXTERNAL_ONLY |

## Licensed feed contract

This is EasyJob's versioned interchange schema for an **explicitly licensed partner feed or deployment-owned gateway**, not an invented API belonging to any named vendor. Obtain the vendor schema and redistribution authorization before configuring a gateway. APEC XML is a confirmed partnership offering, but its private schema has not been mapped. Careerjet public search is user-triggered and cannot be repurposed for anonymous background crawling.

`GET <configured HTTPS FEED_URL>`, optional Bearer token. Redirects rejected. JSON pages:

```json
{"version":"easyjob-v1","jobs":[],"total":0,"next":null,"complete":true}
```

Each job requires stable `id`, `title`, `url` (HTTPS), and `description` (may be an explicitly incomplete excerpt). Optional names match `ExternalJobListing` in `src/jobs/sources/job-source.types.ts`. Dates ISO-8601, numeric salaries in the supplied currency and `salaryPeriod`; no currency conversion, guessed salary or invented company. Lifecycle status OPEN/CLOSED/EXPIRED/PAUSED/REMOVED. `next` is an absolute same-origin HTTPS URL. `total` is stable across the snapshot. Only an explicit complete, unrejected, count-consistent snapshot can reconcile missing records. Duplicate IDs and truncation prevent reconciliation. Unknown vendor data preserved in source raw metadata; never put credentials in records.

Credentials live in environment variables. The server records error codes, never raw upstream bodies or secret URLs. HTTP 401/403 = authorization required; 429/5xx/timeouts = temporary failure and queue retry. Missing records require `JOB_SOURCE_MISSING_GRACE_HOURS` (default 72), and a successful later snapshot. Failures never expire records.

## Public UX observations

Keejob and TanitJobs emphasize company/title/location, date and employer actions; Welcome to the Jungle emphasizes employer identity and workplace information; APEC emphasizes role and career context; Indeed and LinkedIn have separate search/detail/application contracts. These observations inform an original EasyJob card/detail layout, not copied markup or logos. Glassdoor review content is outside scope. JobReview identity is unverified. No assertion that all providers expose salary, logos or native application.

## Operations

`/admin/job-sources` exposes configured state, last successful synchronization, last failure, duration and counters; `/admin/integrations` links to the same view. Queue failures remain in BullMQ for diagnosis. Changes require `prisma migrate deploy` and client generation. Existing listings/history are preserved. ANETI public HTML parsers are disabled unless explicit `JOB_SOURCE_ANETI_AUTHORIZED=true` / `JOB_SOURCE_ANETI_INTERNATIONAL_AUTHORIZED=true` permissions are configured.

## Remaining provider work

No live partner credentials/contracts were supplied for these 11 integrations. Consequently native vendor mappings, live catalogue completeness, provider application submission and provider-specific lower rate limits cannot be verified. They must not be advertised as operational. The licensed interchange layer is testable locally and usable only for approved feeds. Native EasyJob applications remain the supported submission path.


## Candidate submission and Auto-Apply

Native EasyJob submission requires an active verified employer, open vacancy, verified candidate email, owned selected CV, reviewed candidate snapshot, consent, and validated dynamic answers. The exact stored file ID is attached. It does not create a replacement Markdown CV. Application and event are committed together; unique job/candidate constraint prevents duplicate applications.

External employer navigation is FREE and recorded as `EXTERNAL_SITE_OPENED` with `submitted: false`; it does not require purchasing preparation. Premium preparation uses the existing `ai.cover_letter` entitlement on the server and proposes evidence from the user's profile/CVs, never a fabricated background. The user reviews and chooses the actual file.

Auto-Apply is restricted to the existing `career.auto_apply` entitlement (currently PREMIUM; PRO does not include it). Defaults to `approvalRequired=true`; unattended submission requires a separate explicit consent timestamp. Native supported jobs only, selected owned PDF, fresh preferences under a row lock, UTC daily/weekly limits, excluded companies/keywords, target titles, experience, required skills, location/work mode/salary/contracts. Plan feature keys `career.auto_apply.daily_limit` and `.weekly_limit` can specify limits; absent values use conservative caps of 3/day and 10/week. Required questions always return the job to candidate review. Notifications of submission follow a committed application, never just opening a tab. External source auto-submission remains unavailable until a provider contract is implemented and verified.

Legacy fixtures and manually curated external offers that were seeded as native EasyJob jobs are excluded from candidate discovery and native submission; history is retained. This avoids falsely routing external applications to synthetic employer accounts.

## Known implementation limits

Company identity uses a source-provided domain plus name; without a domain it is source-scoped, never guessed from a brand name. Duplicates use stable provider IDs first, then exact rich-content fingerprints or conservative detailed-text similarity with company/title/location/reference/salary/date consistency. This favors missed merges over merging distinct vacancies. Full-text matching currently scores filtered database rows before pagination, without a persisted per-candidate score index; large-catalogue load testing and a materialized score/search index remain necessary before high-volume production rollout.

File questions currently select an owned stored CV attachment. General-purpose supporting document upload is not implemented. Employer form schemas can be set through the authorized jobs API; a recruiter-side form designer is outside the current candidate UI. XML/native mappings behind partner contracts, provider API/email submission, and live provider acceptance tests remain blocked on their documented contracts and access. No real application was sent to an external employer during validation.
