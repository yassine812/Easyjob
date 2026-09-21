# Startup Starter — AI Service

FastAPI service that handles all AI processing for the platform. It is **only ever called by the NestJS backend workers** (never by the frontend directly).

## Endpoints

| Endpoint            | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `POST /ai/cv/extract`   | Extract text from a CV (PDF/DOCX/text)     |
| `POST /ai/cv/analyze`   | CV analysis: scores, strengths, weaknesses |
| `POST /ai/cv/generate`  | Generate a CV from candidate profile data  |
| `POST /ai/job/analyze`  | Job description analysis                   |
| `POST /ai/match`        | Candidate ↔ job matching scores            |
| `POST /ai/cover-letter` | Cover letter generation                    |
| `POST /ai/interview`    | Interview question preparation             |
| `GET  /health`          | Liveness check                             |

## Providers

Providers are pluggable via the `AI_PROVIDER` env var:

- `rule_based` (default, offline) — deterministic heuristic scoring; ideal for development, tests and demos. No external credentials.
- `openai` — real LLM calls. Requires:
  ```
  AI_PROVIDER=openai
  OPENAI_API_KEY=sk-...
  OPENAI_BASE_URL=https://api.openai.com/v1   # optional
  OPENAI_MODEL=gpt-4o-mini                    # optional
  ```

All responses are normalized into a stable JSON shape (`overall_score`, `strengths`, `weaknesses`, `missing_skills`, `ats_compatibility`, `skill_match`, `experience_match`, `location_match`, `seniority_match`, `overall_match`, `cv_markdown`, …) so the NestJS side is provider-agnostic.

## Running

```bash
python -m pip install -r requirements.txt
AI_PROVIDER=rule_based uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Tests

```bash
AI_PROVIDER=rule_based python -m pytest -q
```

## Docker

```bash
docker build -t startup-starter-ai .
docker run -p 8000:8000 -e AI_PROVIDER=rule_based startup-starter-ai
```
