# Optioncarriere / Careerjet

Reviewed 2026-09-23. Integration status: **REQUIRES_API_CREDENTIALS**. Runtime availability is reported separately; no missing credential is treated as an active integration.

## Evidence and limitations

[Optioncarriere / Careerjet official material](https://www.careerjet.com/partners/api). Publisher search API is documented, but requires the real searching user IP and user agent. Background caching and redistribution require separate permission; use an authorized feed for daily synchronization.

Evidence proves only the capabilities described above. The public website is not a redistribution license.

## Implemented adapter

Dedicated `OptioncarriereAdapter` supports the explicit [EasyJob licensed feed contract](../JOB_SOURCE_CAPABILITIES.md#licensed-feed-contract). This is a deployment gateway contract, **not a claimed native Optioncarriere / Careerjet endpoint or schema**. Vendor-native catalogue mapping is **TO CONFIGURE / NOT VERIFIED** until the provider supplies its contract. No scraping fallback.

Configure `JOB_SOURCE_OPTIONCARRIERE_AUTHORIZED=true` only after written permission, then `_ENABLED=true`, `_FORMAT=easyjob-v1`, `_FEED_URL` (HTTPS), optional `_TOKEN` (secret), `_MAX_PAGES` (default 100). Never commit credentials. Bearer authentication applies to the licensed gateway; actual vendor authentication remains as specified by the contract.

## Data and logos

The gateway can supply all normalized fields: company identity/website/logo/industry/location, title/reference, complete description, responsibilities, requirements, optional qualifications, benefits, skills, languages, education, experience, contract, work mode, address, salary/currency/period, publication/update/deadline, positions and original/application URL. Unknown fields remain absent. Original records and normalized source snapshots are retained. HTTPS logos are used only when supplied; no guessed brand images. Description excerpts are never presented as complete employer details.

## Application capabilities

`EXTERNAL_ONLY`: employer navigation only. No automatic submission, email sending or false success. `SOURCE_API_APPLY` and `EMAIL_APPLY` remain unavailable until specific authorization, question schema, attachment transport and provider confirmation are implemented and verified. A feed field cannot grant these privileges.

## Synchronization and errors

Every 24 hours via BullMQ, 15-second request deadline, same-origin pagination, 250 ms minimum between pages (gateway ceiling 4 requests/s, lower provider limits must be configured before activation), capped pages, bounded response size. Three queue attempts with exponential backoff; failed jobs retained. Authentication/HTTP/schema/timeout failures recorded without tokens or response bodies. Incomplete snapshots do not close listings. Complete successful snapshots use a configurable 72-hour missing grace period. Explicit source closures and deadlines are honored. Provider-specific quotas: **TO CONFIGURE** unless documented in evidence.

## Verification

Shared contract tests run against every dedicated adapter using isolated HTTP fixtures. They verify code behavior, not live provider access or partnerships. Live credential test: **NOT RUN**. Native vendor endpoints: **NOT VERIFIED**. Actual provider counts are available in `/admin/job-sources` only after successful authorized synchronization.
