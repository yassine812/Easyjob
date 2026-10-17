EasyJob deterministic job drafting v2

Runtime path: NestJS entitlement + company permission -> /drafting/jobs -> Pydantic
request -> JobKnowledgeBase -> Jinja2 -> Pydantic response -> quality validation.
The router shares the existing Python host but imports no AI provider, NLP model,
embedding service or network client. It can run and be tested independently of
app.main (which also hosts unrelated interview and face services).

The checked-in O*NET 31.0 subset is the source layer. EasyJob's roles.json preserves
existing role IDs and maps specialties to broader source occupations. families.json
defines reviewed activities, scopes and collaboration for 19 families. Search uses
the approved aliases; broad O*NET titles are retained for editorial review rather
than automatically assigned to every technology specialization.

Jinja2 templates/<locale>/families/<family>.j2 defines family prose. Professional,
concise and technical templates organize it differently. Company, seniority and
collaboration partials are reusable. Never interpolate employer text as a template.
Edit family JSON and its family macro together; tests enforce their consistency.

Responsibilities are generated from six distinct family activities using approved
seniority-dependent grammar, including French contractions. Django/PostgreSQL and
Terraform clauses only appear when supported by the role or employer's selected
skills. A stable SHA-256 seed of role + seniority + company + engine version selects
approved variations. Babel formats localized skill/activity lists. No random global
state, timestamps, model outputs or paid APIs participate in drafting.

Working conditions and profile requirements are separate from narrative text.
Unknown industry labels are omitted instead of leaked untranslated. Explicit
employer skills are retained; the engine cannot invent skills outside the role's
core/optional set. There is no silent fallback to the old generator if validation
or the Python service fails.

Update source data explicitly: python scripts/import_job_knowledge.py
Validate: python -m pytest tests/test_job_drafting.py
No migration or external API credentials are required for the dataset.
