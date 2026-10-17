# Job aggregation and application methods

## Verified sources and current status

| Source | Supported method | Authentication and rate | Current status |
| --- | --- | --- | --- |
| ANETI | Read the public search results at `emploi.nat.tn/fo/Fr2026/global.php?page=9` and link each offer to its official detail page. This is public HTML, not a JSON API. | No login. One full-catalogue fetch every 24 hours. Offers missing from a complete feed or past their closing date are closed. | Active when the worker can reach the public page. |
| ANETI International | Read the public `/index.php/offres` listing. Each original detail link remains attached to the job. | No login. One listing fetch every 24 hours. Offers missing from a complete feed or past their closing date are closed. | Active when the worker can reach the public page. |
| Jooble | Official REST search API. One scheduled keyword query, up to 50 results. | `JOOBLE_API_KEY`; daily. The key is not set in this workspace. `JOOBLE_SYNC_KEYWORD` defaults to `emploi`; `JOOBLE_API_BASE_URL` defaults to `https://tn.jooble.org/api/`. | Configuration required until a key is supplied. See [Jooble API documentation](https://jooble.org/api/about). |
| TanitJobs | The documented recruiter API publishes a recruiter's own jobs to TanitJobs and returns applications; it is not an inbound catalogue for job seekers. | Subscriber account and API key for the outbound recruiter integration. | Integration required; EasyJob does not scrape or treat that key as search access. See [TanitJobs API integration](https://www.tanitjobs.com/aide-recruteur/api-integrations/). |
| LinkedIn Jobs | LinkedIn's documented Job Posting API is for approved partners to publish jobs to LinkedIn, not a general inbound search API. | Partner approval and signed API terms. LinkedIn currently says it is not accepting new Job Posting API partnerships. | Authorization required; no scraping or fake API endpoint. See [LinkedIn Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview?view=li-lts-2025-01). |

There are no production demo listings. The ANETI pages allow public access in their current `robots.txt`; the worker requests only the public listing and original offer details, with no login or protected-file downloads. These are public HTML interfaces and can change, so a parser failure is reported as a source outage instead of a successful empty import.

## Data flow

The worker schedules source-specific BullMQ jobs and syncs independently of candidate page loads. Each adapter normalizes only fields present in the provider response. Listings and original source URLs are upserted into `AggregatedJob` and `AggregatedJobSource`; public search pages query only this central database. Candidate filters and counts are calculated from stored live listings. Stale jobs are closed only after a complete listing sync; a partial response cannot close jobs that were not in that response. Explicit closing dates are also honored. Source update timestamps remain distinct from publication dates.

Duplicate detection normalizes company, title, and location. If the company is not supplied, it uses title, location, publication date, and available description text to avoid merging unrelated roles. Canonical external jobs keep every original source reference. The EasyJob marketplace also combines matching internal and external cards in the current result set. Search and detail responses preserve each source URL and application method.

## Application methods

- `NATIVE_EASYJOB`: verified EasyJob jobs use the authenticated EasyJob application endpoint. The multi-step form prefills the candidate's account identity, profile data, and CV list; the candidate reviews the snapshot, selects a CV, edits an optional cover letter, and submits. Existing application matching and status tracking remain in use.
- `EXTERNAL_APPLICATION`: the candidate opens the EasyJob detail page, reviews their profile and CV, and saves a preparation record. Only the final button opens the source's HTTPS application URL. EasyJob records that the source page was opened, never that the external application was submitted.
- `EMAIL_APPLICATION` and `UNKNOWN`: no automatic submission is attempted. The UI reports that a supported application method is unavailable until a verified route is supplied.

External preparation records and external saves are candidate-scoped. APIs resolve the candidate from the authenticated session rather than accepting a candidate ID from the request. Native resumes are checked against the authenticated candidate before submission.

## Operational limitations

Public source listings may omit employers, salaries, requirements, work mode, or closing dates. EasyJob leaves unavailable fields blank and does not produce a match score from insufficient evidence. Source status, indexed/active/closed counts, and technical setup notes are exposed through the platform-admin `Job sources` page; candidates see a localized empty state instead of integration diagnostics.
