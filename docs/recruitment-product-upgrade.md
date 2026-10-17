# Recruitment product upgrade — audit and delivery record

## Audit (24 September 2026)

Existing: owned CV uploads/extraction, section parsing, nine weighted text checks, job-source provenance and availability filters, multi-dimensional lexical matching, dynamic employer fields, selected-CV letters, application/profile/text snapshots, pipeline events, paid server-side builder/letter/automation gates, interview preparation, CV proposal approval and eight templates.

Missing: cited requirement-level evidence states; reliable distinction between profile evidence and selected-document coverage; professional audit dimensions; artifact-level PDF inspection; application preflight and consistency review; immutable draft revisions and source/target metadata; generated PDF publication; sample-qualified outcome insights.

Weak/incorrect: matching concatenates every CV, lexical absence becomes zero compatibility, full requirement sentences require exact matches, native letters are always treated as mandatory, generated CV publication stores Markdown even though applications expect PDF. Section improvement has little opportunity context. A prompt is not factual validation. No audit of PDF columns/tables can be claimed from plain text.

Duplication: Python provider analysis and TypeScript ATS checks use different scoring. Frontend guesses requirements already available on the server. Application preparation and matching repeat profile selection logic.

## Architecture

Extend the existing career/application services. Add pure shared evidence, audit and preflight functions with a versioned methodology. Store source locations and quotes, evidence status and uncertainty. Keep current response fields for compatibility while exposing richer diagnostics. Use the same analysis for preview, publication and submission snapshots. Unknown document properties remain unknown until inspecting the PDF. Preserve existing ownership/plan checks and free manual application access.

Add draft revision storage and metadata with an additive migration. Publish an actual PDF through the existing private AI/document service, inspect its extracted text again, and retain editable content separately. Never mutate the uploaded master. Keep job-specific preparation, versions, letter review, questions, preflight and interview links connected in the candidate UI. Recruiter evidence is exposed only through existing application access checks.

## Validation and progress

Implemented in the existing career/application services and candidate/recruiter screens:

- Job requirements carry published-field or sentence citations. Selected-CV and profile evidence remain separate. Requirement states distinguish explicit, partial, transferable, absent and conflicting text; protected personal attributes are excluded from fit dimensions.
- The opportunity workspace selects an owned CV, explains requirement coverage and opens a job-targeted draft. Recommendations respect preferences, availability and deduplication. Search normalizes common role/location/remote/seniority intent without overriding explicit filters.
- The professional CV audit exposes nine dimensions, quoted weaknesses, a section inventory and PDF inspection. Missing layout evidence remains unknown. The uploaded original is preserved.
- Drafts retain source, target job/role, language and version. Saves use optimistic concurrency and immutable prior revisions. Section/line proposals require acceptance; review compares the same diagnostic dimensions before and after.
- Approved publication generates a real, selectable-text A4 PDF, validates its signature and extracted word sequence, re-runs the diagnostic, and stores editable content and provenance separately. The application-ready publication layout is single-column; the designer's browser print export retains its chosen visual layout.
- Employer questions and letter requirements are dynamic. Free manual applications retain basic validation; deep evidence, editing, AI letters and insights require server-side entitlements. Cover letters have short/standard/detailed variants grounded in the selected CV.
- Submission re-runs quality checks and captures immutable job/CV/answer/evidence snapshots. Candidate tracking and the authorized recruiter dossier expose those snapshots. Interview preparation carries the selected CV and job.
- Outcome insights show observed counts by CV only for cohorts of at least five applications, each at least 30 days old. Cancelled interviews are excluded; offers do not imply that an interview occurred. No causal explanation or hiring prediction is generated.

### Scoring contracts

`evidence_coverage_v2` is a documented-coverage index, not a success probability. Required requirements weigh 2; preferred/unspecified requirements weigh 1. Explicit evidence earns 1, partial .5, transferable .25, absent/conflicting 0. The weighted percentage is rounded to an integer. No requirements or no candidate text means an unknown score, not 0/100. Separate selected-CV coverage prevents profile-only evidence from appearing to be in the document.

`professional-cv-audit.ts` documents each dimension's passed checks, total checks, method and uncertainty. Keyword coverage and job relevance remain unknown without job keywords; they are not independent semantic estimates. Existing overall ATS checks remain backward compatible and are separate from job coverage. Layout/template changes do not earn arbitrary points. No score uplift is promised for stylistic rewriting.

`application-quality.ts` distinguishes PASS, REVIEW, BLOCK and UNKNOWN. Missing/invalid PDF, contact details or mandatory employer answers block submission. Evidence gaps and possible contradictions prompt review rather than silently changing answers. Readiness is passed/evaluated checks; unknown checks are excluded. This is a completeness diagnostic, not a hiring estimate.

### Validation record

Focused backend, Python and component suites cover evidence states/citations, selected-source isolation, paid gates, revisions/concurrent edits, factual rewrite guards, PDF generation/text preservation, dynamic fields, submission snapshots and outcome minimum samples. TypeScript and Nest compilation are checked separately.

Real local validation uses an existing candidate profile, its processed two-page PDF and an open ANETI listing. The quality check identified a contact-email inconsistency instead of hiding it. Generated PDF word order/content was preserved, both pages were rasterized and visually inspected, and headings were kept with following content. A service integration run created a targeted draft, saved/approved it with a retained revision, published its actual two-page PDF, and passed that selected PDF through preflight. The original record and file bytes were compared and remained identical. Temporary draft/PDF records and storage objects were cleaned up. No real application was submitted.

Final checks: 60 backend tests across eight suites; 47 Python tests across PDF, factual editing and career suites; 18 frontend tests across four suites (including server-preflight rejection despite consent). Nest build and web TypeScript checks passed. API and AI services were restarted and returned healthy status.

Browser checks at desktop and 390 × 844 mobile sizes covered expandable evidence/citations, audit cards and proposal review, including keyboard focus and visible acceptance/cancellation controls. These are component-flow checks, not a claim that every authenticated production flow was exercised.

### Explicit limits

Local development uses the rule-based provider unless explicitly configured otherwise. It can safely restructure/rephrase supported wording; it does not provide unrestricted semantic writing. A configured generative provider additionally passes conservative source-vocabulary, number and contact checks, then still requires candidate review. This filter is not independent fact verification.

Requirement extraction uses a finite alias/relationship vocabulary and explicit wording, so unfamiliar or compound qualifications can require manual review. Experience duration is used only when documented explicitly. PDF column/table/header detection is geometric and reports uncertainty; image presence does not prove image-only text, and OCR is not claimed. Outcomes cover tracked EasyJob applications only; opening an external site is not submission or response evidence.
