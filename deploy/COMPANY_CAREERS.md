# Official employer jobs in Tunisia

EasyJob's `COMPANY_DIRECT` source imports public postings from EY Careers and the public SmartRecruiters company boards for Devoteam and Sopra Steria / Sopra HR Software. Only postings with a verified Tunisian location are imported. This uses the existing catalogue, matching, saved jobs, source management and BullMQ scheduler; it does not create native EasyJob company vacancies or submit applications.

The collector is enabled by default. API and worker share the settings in `backend/docker-compose.prod.yml`. It runs on worker initialization and every 24 hours. Set `JOB_SOURCE_COMPANY_DIRECT_ENABLED=false` to disable it. `JOB_SOURCE_COMPANY_DIRECT_MAX_PAGES` defaults to 10 and is capped at 30.

Each job retains its original employer application link, stable requisition identity, actual posting date and actual expiry where published. Salary is left blank when unavailable. Repeated imports update the same source reference. A confirmed complete snapshot uses the existing 72-hour missing-offer grace period; an employer failure or rejected record prevents missing-job reconciliation. Source-supplied expiration dates still apply.

Requests are sequential per employer, delayed by 300 ms, limited to verified HTTPS hosts, bounded to 8 MB and 20 seconds, and do not follow redirects. No credentials, paid provider, browser sessions, or anti-bot bypass are used.

ADP's official Tunisia portal is checked once per run. Its current HTTP 403 is reported as `ADP:COMPANY_HTTP_403`. No ADP listings are invented, imported from cached search snippets, or reported as active integration. If that endpoint becomes reachable, it remains `CONNECTOR_PENDING` until its listing parser is implemented and verified. The three implemented employers continue importing independently. Non-fatal warnings are persisted in the source and sync run error-code fields and detailed employer counts are logged by the worker.

Manual import after building the backend:

```powershell
cd backend
npm run jobs:sync:companies
```

On the deployed stack:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec api node scripts/sync-company-careers.cjs
```

Use `--probe` to fetch and validate without database writes. The manual import saves `backend/.runtime/company-careers-last-sync.json` (or `/app/.runtime/company-careers-last-sync.json` in a container). Do not mistake a successful partial import for ADP availability; inspect the employer report and source warning.

Validation: `test/unit/company-careers-adapter.spec.ts` exercises Tunisia filtering, nested HTML, URL origin validation, private-posting exclusion, missing fields, explicit closure, outage isolation, and disabled configuration. Existing source lifecycle tests cover confirmed removals versus transient outages.
