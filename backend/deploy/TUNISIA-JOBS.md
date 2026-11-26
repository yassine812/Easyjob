# Daily Tunisia employer jobs on the VPS

The production `docker-compose.prod.yml` runs the collector in the **worker**
container, with the same database used by candidate search. It needs no Windows
process, desktop browser, user login, external cron, or paid API key.

`JOB_SOURCE_COMPANY_DIRECT_ENABLED` defaults to `true` in the adapter and in
Compose. `JOB_SOURCE_COMPANY_DIRECT_MAX_PAGES` defaults to 10 (up to 1,000 listings
per SmartRecruiters employer). Reaching a cap produces a partial result and does
not remove missing offers. A new worker queues an initial sync; a stable BullMQ
scheduler then runs every 24 hours. Redis uses append-only persistence and a named
volume; worker/API restart automatically unless explicitly stopped. Missed runs
resume when the worker is back online. Global queue concurrency is one.

## Verified sources and scope

- EY: official careers pages.
- Sofrecom Tunisie: official employer portal; Tunis and Sfax; PDF/DOC/DOCX descriptions.
- Devoteam and Sopra Steria / Sopra HR Software: public SmartRecruiters postings.
- LEONI: public SmartRecruiters `LEONI1`, linked by its Tunisia jobs portal.
- Accor, Lesaffre, Bosch: public SmartRecruiters postings located in Tunisia.
- Tanitjobs: public paginated job catalogue, across all published sectors and locations.
  Enabled by default (`JOB_SOURCE_TANITJOBS_ENABLED=true`); no paid API or login.
  The worker follows observed page links, with a 250-page ceiling and one request
  per second. Cards supply genuine description excerpts, not full descriptions;
  candidates follow the original Tanitjobs offer to read the full text and apply.
  Locations are retained as published; an ambiguous location is not relabelled Tunisia.
  Explicitly closed cards are hidden on the daily run. Missing cards are removed
  only after terminal pagination and a reconciled catalogue count. A changing
  count, truncated collection, parsing failure or HTTP denial prevents that removal.
  Up to 75 old missing references are independently checked per run: only confirmed
  404/410 responses or expired/closed postings remove them. Public JSON-LD details
  are used for that check; access failures never imply closure.

No occupation filter is applied: software, telecom, industrial production,
maintenance, logistics, HR, finance, marketing and hospitality can all appear.
Coverage follows these employers' actual published locations and vacancies;
this is **not** a claim to index every Tunisian employer or every specialty.
ADP currently rejects requests with HTTP 403 and is explicitly reported blocked.
No protection is bypassed and no invented ADP vacancies are displayed.
Some public Sofrecom listings link to Orange-protected Word attachments. Those
listings retain their public title, reference, location and application portal;
the description explicitly says the detailed document is not publicly accessible.
They are reported as `PROTECTED_DOCUMENTS` rather than being decrypted or given
invented requirements. Their presence/absence remains verified from the public list.

## Lifecycle and failure handling

Stable employer/reference IDs update existing jobs without duplication. Edited
descriptions can replace older, longer versions. Offers with an elapsed deadline
are excluded from candidate results. Explicit closures and offers absent from a
successfully completed employer list are removed from active results in that run.
Records and application history are retained; a reopened reference can become
available again. A timeout, denial, parsing error or truncated list never means
that the employer has closed all its vacancies. Other healthy employers continue
to synchronize and reconcile independently. Per-source warnings and counts are
stored in `JobSource` and `JobSourceSyncRun` for the administration interface.

PDF and Word text extraction use `poppler-utils`, `unzip` and `antiword`, installed
by the backend Dockerfile. Neither requires a desktop application. Requests are
sequential, bounded in duration/size and limited to official configured hosts.
Applications redirect to the employer's original posting/portal, not to a fake
EasyJob application form.

## Deployment and checks

Build API and worker from this source using the existing production Compose
deployment and its private environment file; start the full stack as usual.
PostgreSQL/Redis and their volumes must remain part of that deployment. Preserve
outbound HTTPS access from the worker. No extra job collector service is needed.

The worker healthcheck runs `node scripts/job-sources-health.cjs`: it checks a live
heartbeat, the persistent 24-hour scheduler, and a successful employer sync within
36 hours (30-minute allowance for the first employer/Tanitjobs collection). Docker marks a failed check
unhealthy; it does not itself send email or restart an unhealthy running process.
Use the VPS's existing monitoring to alert on unhealthy containers.

Manual refresh, using the same production environment:

```sh
docker compose -f backend/docker-compose.prod.yml --env-file YOUR_ENV_FILE exec worker node scripts/sync-company-careers.cjs
docker compose -f backend/docker-compose.prod.yml --env-file YOUR_ENV_FILE exec worker node scripts/job-sources-health.cjs
```

Run manual refreshes only when a scheduled source sync is not running. Daily
automatic refreshes need no manual command. `--probe` fetches without writing jobs.

For regression validation, `scripts/verify-company-lifecycle.cjs` requires an
empty, migrated disposable PostgreSQL database whose name ends in `_validation`,
and Redis. It tests additions, edits, closures, removal, outage isolation,
reopening, deduplication and real persistent scheduler initialization. It refuses
to run against a normal database. Its Redis test queue is isolated and removed.
