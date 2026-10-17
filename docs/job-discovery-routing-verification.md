# Job discovery and recruiter routing verification — 2026-10-07

## Confirmed causes

- The scoped applications page already existed at `web/src/app/(company)/company/[companyId]/jobs/[jobId]/applications/page.tsx`. Its URL was correct. The running Next.js development server's route index omitted the applications/edit/preview children. An HTTP request reproduced the 404; restarting the same frontend on port 3000 restored discovery and returned 200. No duplicate page or redirect was added.
- Candidate logs recorded a successful `/api/v1/career/jobs?sort=match&page=1` response taking 16,785 ms, exceeding the frontend's unconditional 15-second abort. The four company offers were not excluded by the candidate visibility predicate.
- General browsing now defaults to `newest`, while recommendations default to `match`. React Query supplies cancellation instead of an arbitrary 15-second abort. General browsing no longer loads/initializes AutoApply preferences. External CV scoring is deferred until after pagination only when no score-based filter, matching sort or recommendation requires full scoring.

## Publication and visibility

The persisted active/public state remains `PUBLISHED`; no second enum or visibility flag was introduced. `availableJobWhere()` already centralizes candidate search, public lookup and saved-job checks. It requires a published job, an active verified company, an unexpired or absent expiry, and the existing fixture/source exclusions. Company context is used only when explicitly supplied as a search filter. General browsing does not apply CV preferences or a minimum score automatically.

EasyJob Test Company: `cmuth8lr3000imxixten8rpgi`, ACTIVE, VERIFIED. All four offers close on 2026-11-19:

| Offer | ID | State | Applications |
| --- | --- | --- | --- |
| Backend Developer — Python / Django | cmuv344dc004i10kt6sn0h54z | PUBLISHED | 12 |
| Full-Stack Developer — React / Django | cmuv344jc004t10kthu4l19jt | PUBLISHED | 8 |
| DevOps Engineer | cmuv344oc005a10ktyo6vx3vg | PUBLISHED | 4 |
| Mobile Developer — React Native | cmuv344m4005210kts61zhgdz | PUBLISHED | 5 |

`GET /api/v1/career/jobs?sort=newest&page=1&limit=50` returned all four IDs among 19 available jobs, without a company or profile filter. The CLOSED Data Analyst and DRAFT QA offer were absent. A company-filtered request returned exactly these four offers.

## Recruiter navigation and permissions

The original and retained URL is `/company/{companyId}/jobs/{jobId}/applications`.

Shared helpers in `web/src/lib/job-display.ts`: `recruiterJobsRoute`, `recruiterJobRoute`, `recruiterJobApplicationsRoute`, `recruiterJobPreviewRoute`, `recruiterJobEditRoute`. Cards, job detail/preview, dossier return links and dashboard links use them. Successful duplication opens the returned draft's edit route.

The scoped board loads the managed job and checks its company before requesting applications. It does not show an Offer selector. Its All count uses unfiltered stage counts. The API also calls `assertJobPermission(userId, companyId, jobId, 'application.view')`, including company membership and assignment restrictions.

Live checks after the API update:

- DevOps detail, preview, edit and applications URLs: HTTP 200 on localhost:3000.
- Company card count and scoped API total: 4; stages: APPLIED 1, REJECTED 3.
- Requesting another company's job under this company: HTTP 403.
- Candidate requesting this company's applications: HTTP 403.
- Root 404 now selects explicit recruiter, candidate or public return destinations from the URL; recruiter errors never link to candidate Find Jobs.

## UI verification and limits

The connected in-app browser had an existing candidate session. Navigating to a company URL correctly returned that candidate to their dashboard. Through the actual Find Jobs navigation, the catalogue loaded without error: Backend and Full-Stack appeared on page 1, DevOps and Mobile on page 2. This is chronological pagination, not exclusion.

A simultaneous second authenticated recruiter browser was not available through the connected browser tooling. The recruiter click sequence and duplication were therefore not manually executed. Recruiter routes, real counts and access boundaries were checked through HTTP, plus component tests. No offer or application was created, published or deleted during verification.

## Automated checks

- Backend `tsc --noEmit`: passed.
- Frontend `tsc --noEmit -p web/tsconfig.json`: passed.
- Frontend routing/card/scoped applications: 5 passed; 404 workspace behavior: 3 passed; route/display helpers: 5 passed; candidate behavior: 14 passed.
- Backend application workflow and marketplace pagination: 10 passed, including cross-company refusal and deferred CV scoring without changing match-first pagination.
- Existing navigation tests were updated to supply the actual TooltipProvider and assert the tab roles used by the navigation components.

- Backend career service and local fixture visibility: 13 passed. Total focused checks: 50 tests passing.

## Files changed for this correction

- `web/src/lib/job-display.ts`, `web/src/lib/job-display.test.ts`
- `web/src/components/company/recruitment-workspace.tsx`
- `web/src/components/company/job-workspace.tsx`
- `web/src/components/company/application-dossier.tsx`
- `web/src/components/company/recruiter-home.tsx`
- `web/src/components/company/workspace-overview.tsx`
- `web/src/components/company/application-navigation.test.tsx`
- `web/src/app/not-found.tsx`, `web/src/app/not-found.test.tsx`
- `web/src/lib/i18n/support.ts`, `web/src/lib/i18n/career.ts`
- `web/src/components/candidate/career-pages.tsx`, `web/src/components/candidate/career.test.tsx`
- `src/applications/applications.service.ts`
- `src/career/career.service.ts`, `src/career/job-marketplace.service.ts`
- `test/unit/application-workflow.spec.ts`, `test/unit/career-service.spec.ts`, `test/unit/marketplace-pagination.spec.ts`
