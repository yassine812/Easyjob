# FreeHire collector for EasyJob

FreeHire is an isolated, self-hosted source for the existing EasyJob catalogue. It does not replace the frontend, authentication, matching, CVs, interview tools or applications.

Upstream: https://github.com/strelov1/freehire (MIT), pinned at `804c174d91fea3d94378967a2c8e2deb7bb1d4e7`. Its license is included in the built image. The public hosted API is not a free commercial data feed: https://freehire.me/docs/api. This adapter intentionally rejects those hosted domains. Self-hosting the code does not grant rights to every upstream site's content; enable employer/ATS sources whose collection and display you are allowed to use.

## Local setup (repository root)

Requires Git, Node and Docker Desktop with Linux containers. No API subscription or paid LLM is needed for this collector.

```powershell
node scripts/freehire.cjs setup
node scripts/freehire.cjs start
node scripts/freehire.cjs add-board greenhouse <board-id> "Company name"
node scripts/freehire.cjs collect
node scripts/freehire.cjs status
```

`setup` downloads the pinned source into ignored `.runtime/freehire-upstream`, creates local random credentials in `.runtime/freehire.env`, and builds only the server, ingestion, migration and board-management binaries. PostgreSQL and Redis are separate from EasyJob's databases. Only the API port 8085 is published, on loopback. No FreeHire web UI, paid enrichment, auto-apply or access to EasyJob candidate data is configured. `stop` stops containers without deleting stored jobs.

Start with a small set of Greenhouse boards. The collector refreshes registered Greenhouse boards daily. Other ATS providers exist upstream but require an explicit collector configuration change; merely registering a non-Greenhouse board does not schedule it. The CLI deliberately only accepts the configured provider. Sources fail independently; logs are available with `docker compose --env-file .runtime/freehire.env -f deploy/freehire/compose.yml logs collector`.

## Connect EasyJob

Apply the additive Prisma migration `20261022090000_freehire_source` using your normal migration deployment procedure, regenerate the backend Prisma client, then add to **backend/.env**:

```dotenv
JOB_SOURCE_FREEHIRE_ENABLED=true
JOB_SOURCE_FREEHIRE_SELF_HOSTED=true
JOB_SOURCE_FREEHIRE_API_URL=http://127.0.0.1:8085/api/v1
JOB_SOURCE_FREEHIRE_MAX_PAGES=10
JOB_SOURCE_FREEHIRE_RECHECK_LIMIT=100
```

Restart the backend API and BullMQ worker so both see the new enum and settings. The existing source scheduler performs an initial sync and daily refresh. The Platform Admin job-source screen also exposes the normal source synchronization action. For a backend in Docker Desktop, use `http://host.docker.internal:8085/api/v1` if the host service is reachable; on a shared Docker network use `http://freehire-api:8080/api/v1`. For deployment to another server, run this stack there too and use a private network or a secured HTTPS endpoint. Localhost on a deployed server does not refer to your PC.

For a one-shot import after building the backend: `npm --prefix backend run jobs:sync:freehire`. This uses the same normalization, deduplication and lifecycle checks as the worker. With `RUN_WORKERS=false` on the API, a separate worker must be running for periodic EasyJob imports; the FreeHire collector alone only refreshes its own database.

## Data behavior and limits

- Native `/api/v1/jobs` response, full descriptions converted to plain text; no invented salaries, dates or AI claims.
- Original ATS URL and `FreeHire · <ATS>` attribution are retained; applications go to the employer. EasyJob favorites, matching and application preparation use the central catalogue as before.
- Stable public slugs and the existing conservative cross-source deduplication prevent repeated syncs creating copies.
- Up to 1,000 latest jobs per sync by default (100 per page, configurable to at most 10,000). This is intentionally not the hosted FreeHire catalogue of millions of postings.
- Offset pages are not authoritative snapshots. Missing records are never automatically closed just because they are outside a downloaded page.
- Each sync rechecks up to 100 oldest open references not refreshed by the listing pass. Explicit closed details or 404 remove that source reference; timeouts, 429 and 5xx do not. Large catalogues need a higher recheck budget or more frequent syncs. Upstream's own crawl/closure policy also determines freshness; no promise of zero stale jobs.
- 15-second request timeout, 10 MB response cap, no redirects, strict response validation and Retry-After propagation. Failures appear in the existing source status/history. Candidate search never calls the collector synchronously.

## Validation

```powershell
cd backend
node node_modules/jest/bin/jest.js --config jest.config.js --roots test/unit --runInBand --runTestsByPath test/unit/freehire-adapter.spec.ts test/unit/job-source-revalidation.spec.ts test/unit/job-aggregation.spec.ts test/unit/partner-sources.spec.ts
npm run build
```
