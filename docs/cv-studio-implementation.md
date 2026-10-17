# EasyJob CV product refactor

Work within the existing EasyJob codebase and architecture. First inspect the current frontend, backend, APIs, data models, services, and design system. Do not assume or introduce a framework, database, or architecture that is not already used in the project.

## Findings

The repository uses Next.js/React, NestJS/Prisma/PostgreSQL and a Python FastAPI document/AI service. React Query, Radix, existing entitlements and signed document storage remain in use. The former CV designer represented sections as heading/body text with index-based annotations. Library cards stretched to fill empty rows, editing and viewing shared controls, and the published PDF used a separate layout from the designer. Existing immutable draft revisions, optimistic version checks, original-file storage, PDF.js, factual AI validation and ATS criteria are reusable.

## Data flow and architecture

Original PDF → existing upload/storage/parser → conservative structured import → versioned CvDraft.document → contextual editing or guided interview → debounced server save and ATS recalculation → proposal review → explicit approval → rendered PDF/library version. The original file remains immutable.

The shared document contract has persistent section/entry/bullet IDs, typed sections, controlled style tokens, visibility/page-break settings and interview answers. CvDraftRevision retains structured snapshots. Resume updatedAt records actual changes. CV Studio APIs reuse profile ownership, entitlements, ATS and AI services. Browser previews and server exports use the same escaped document markup and typography.

Frontend responsibilities: compact CV cards/actions, read-only viewer, editor loader, editor state/autosave, section fields, paginated document canvas, templates/style controls, ATS/contextual proposals, guided creation and revision history. Dedicated routes live under the existing `/candidate/cvs` convention; legacy builder entry points lead into the same structured workflow.

## Implementation sequence

1. Shared schema, persistence migration and ownership/version-safe APIs.
2. Compact library, creation menu, rename/download actions and dedicated read-only view.
3. Structured editor, contextual fields, autosave/history and template-aware preview/export.
4. Progressive persisted interview, factual proposals and explainable ATS actions.
5. Focused schema/API/UI/PDF tests, compilation and desktop/mobile verification.

No artificial score uplift, fake processing or invented candidate facts. Editorial, structural and ATS formatting improvements run first using existing evidence; additional factual enrichment is optional. Only empty content without usable CV evidence requires facts before writing. Proposals never overwrite content before acceptance. General AI fluency depends on the configured provider; local conservative editing must identify its limits.

## Editorial-first improvement

Studio sends the actual section type and distinguishes a bullet from an entry body. The local provider groups existing skills, preserves unknown skill categories, joins PDF-wrapped category lines, normalizes technology spelling, removes repeated items and turns supported responsibility prose into action bullets. Target-job keywords only reorder evidenced skills. The model provider attempts these same editorial changes; invalid or unchanged generation falls back to local editing. Neutral skills labels are exempted from the vocabulary gate only as line headings, never as factual content. Numbers, employers and qualifications remain protected.

Opening a suggestion automatically requests the first proposal. The comparison keeps the original visible, exposes editable output and puts optional facts/instructions in a secondary disclosure. Apply remains explicit. An unchanged ATS score is explained rather than artificially increased. Canvas actions use labelled, separated buttons and an independent information target instead of overlapping glyphs.

Validated with 43 Python editorial/career tests, 7 Studio API unit tests and 2 suggestion UI tests; backend build and frontend TypeScript passed. The real local API reproduced the reported skills case without additional facts, preserved the draft until Apply and persisted the change. Browser inspection verified action spacing, automatic comparison, Apply, autosave and the improved content after reload. Disposable validation data was removed.

## Validation

- Backend compilation and frontend TypeScript check passed; targeted frontend lint passed.
- 14 backend unit tests, 8 frontend library/autosave tests and 12 Python document tests passed.
- Disposable local candidate exercised authentication, structured save/reload, stale-version rejection, proposal isolation, revision restore, PDF export, approved publication, repeated publication and rename against the real API/database.
- Browser checks covered the compact library, full editor, targeted proposal generation/application, saved version feedback, approval modal and 390px edit/preview switching.
- A two-page A4 export was rendered and visually inspected; extracted text and links were verified.
- Local migration and Prisma client generation were applied. No production deployment or existing candidate subscription change was performed.

## Logical CV versioning

The library now groups immutable Resume rows by a stable logical CV identity stored in the existing design metadata. It exposes only the current version as a card; autosaved CvDraft rows appear only as a subtle working-state indicator on that card. Publishing creates the next immutable version inside the same logical CV, while restoring an older entry creates a new current version and preserves every later entry. The history is available from the card menu. Rename and delete operate on the logical CV, and Duplicate is the only action that creates another logical card.

Validated against the real local API with a disposable candidate: two publications produced one card at v2, an unpublished edit produced the working-state indicator, restoring v1 produced v3 with three history entries, and duplicating then produced exactly two logical cards. The disposable account and stored PDFs were removed afterward.

## International templates and writing quality

Template behavior is declarative and shared by browser preview and PDF export. The catalogue contains ten purpose-specific formats: Canadian French, Canadian English, French, US, UK, International, Tech ATS, Corporate, Minimal ATS and Modern Professional. Metadata records market, supported locales, ATS compatibility, density, section defaults, recommendations and discouraged fields. The editor provides market/category filters and real previews using the current CV content.

CV locale is part of the document contract and remains independent from the EasyJob interface locale. Supported locales are `fr-FR`, `fr-CA`, `en-CA`, `en-US` and `en-GB`. Changing locale opens a choice between relabelling and contextual full translation; it creates a linked draft variant and leaves the source intact. Published variants share one logical library card with `FR | EN` controls while retaining locale-scoped history. Model translation preserves structure, identifiers, identity, technologies, numbers, dates, links and factual scope; the deterministic local provider explicitly falls back to labels only.

The backend writing-quality layer optionally calls a configured server-side LanguageTool endpoint and never exposes its key in the browser. Without that service it performs bounded deterministic checks for repetition, spacing, French punctuation and common plural agreement. The debounced editor displays these findings under a separate `Aa`/Quality surface and adds a contextual underline and correction action; ATS and EasyJob AI remain separate signals.

Real API validation created a French CV and an `en-CA` variant, published both into one card, verified independent v1 histories, detected four writing issues and exported the Canadian template as a selectable-text PDF. Browser validation confirmed the `FR | EN` card controls, all ten model previews, market/category filters, the independent CV locale selector and the separate writing-quality panel.

## Practical limits

The local provider remains rule-based unless a model provider is configured. The guided interview adapts through persisted contextual branches, not unconstrained model-generated questions. Browser and MuPDF share content/style definitions but use different text layout engines, so page boundaries can differ slightly. All templates deliberately preserve a single reading column. New studio-specific interface copy is French; existing ATS copy retains the application's locale support.

