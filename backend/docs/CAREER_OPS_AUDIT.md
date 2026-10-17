# Career-ops audit and EasyJob adaptation

Audited repository: [career-ops](https://github.com/career-ops-hq/career-ops)

- Audited commit: `2bebe32826d6f504652fb473c22e4df7124972a`
- Upstream license: MIT
- Integration mode: ideas and workflows only; no career-ops runtime dependency
- Cost mode: FREE/OPEN-SOURCE and self-hosted

## Reused ideas

EasyJob now exposes candidate-facing, deterministic skills for CV tailoring, job-fit explanation, interview preparation, candidate-authored STAR stories, application follow-up, duplicate/repost review and negotiation preparation. Existing EasyJob applications and CV editor remain the source of truth. CV suggestions are review-first and never applied automatically.

## Excluded

The CLI agent workflow, Claude/Codex/OpenAI/Gemini provider integrations, external plugins, paid search/SaaS services, private social lookup, auto-submit, email sending and any feature that would create an automated hiring decision were excluded.

## Deterministic replacements

The implementation uses the existing EasyJob interview taxonomy and evidence matcher. It normalizes job requirements, aliases and CV sections, produces traceable evidence/gaps, and flags duplicates from public fields (company, title, location, reference and source URL). STAR stories are stored only after candidate input. Negotiation and follow-up outputs are templates derived from candidate/job data.

## API surface

- `GET /career/jobs/:id/tailoring`
- `GET /career/jobs/:id/fit`
- `GET /career/jobs/:id/interview-prep`
- `GET /career/jobs/:id/duplicates`
- `POST /career/jobs/:id/negotiation-prep`
- `GET /career/applications/:id/follow-up`
- `GET|POST|PATCH|DELETE /career/star-stories`

Agent Reach remains optional enrichment for public company context. These candidate features do not call it and do not perform external candidate lookups.
