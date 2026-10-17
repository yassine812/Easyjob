# EasyJob Skills V1

EasyJob Skills are the business layer between product workflows and deterministic or provider-backed capabilities. A workflow sends a narrow `SkillContext` to `EasyJobSkillsService`; the registry selects a versioned definition and the runtime validates input, checks permissions, enforces a timeout, validates output, logs failures and applies a safe fallback.

The first executable skills are:

| Skill | Status | Current integration |
| --- | --- | --- |
| smart-job-creation | IMPLEMENTED | Job autofill returns non-destructive suggestions and keeps the existing deterministic draft. |
| company-public-context | IMPLEMENTED | Job creation and Interview Brief queue the existing Agent Reach + REA research flow. |
| candidate-evidence | PARTIAL | Executable runtime skill is available; existing candidate dossier UI migration remains. |
| interview-brief | IMPLEMENTED | Interview Brief uses the skill output for its 8–12 question set. |
| interview-question-followup | PARTIAL | Executable runtime skill is available; live meeting UI wiring remains. |
| interview-skill-coverage | PARTIAL | Executable coverage result is available; live meeting UI wiring remains. |
| interview-notes | PARTIAL | Notes are normalised as recruiter-only records; autosave wiring remains owned by the interview service. |
| post-interview-summary | PARTIAL | Executable summary is available; post-meeting persistence and UI wiring remain. |
| candidate-cv-tailoring | IMPLEMENTED | Deterministic CV suggestions are based on the exact job and existing CV evidence; every change requires candidate confirmation. |
| candidate-job-fit-explainer | IMPLEMENTED | Compact strengths, transferable skills and gaps explanation; no hiring score or decision. |
| candidate-interview-prep | IMPLEMENTED | Local technical/behavioural themes and questions from the exact job and CV. |
| candidate-star-story | IMPLEMENTED | Candidate-authored STAR story storage and structure, with missing-section checks. |
| candidate-application-followup | IMPLEMENTED | Timeline, waiting time and next-action guidance from existing application events. |
| duplicate-job-detector | IMPLEMENTED | Normalized public-field comparison for duplicates/reposts; never auto-hides. |
| negotiation-prep | IMPLEMENTED | Deterministic checklist and talking points from candidate-provided numbers. |
| transcription / VAD | PARTIAL | Separate AI worker path uses faster-whisper with Silero VAD filtering, consent and retention; LiveKit track streaming and full realtime UI remain. |

The runtime does not execute arbitrary files. Skills are registered in code, versioned as `name@semver`, and documented under `skills/easyjob/**/SKILL.md`. External research is enrichment only and cannot change `match_score`, `potential_score`, ranking or classification. Camera analysis is not part of the skill system.

Feature flags:

```text
EASYJOB_SKILLS_ENABLED=true
INTERVIEW_TRANSCRIPTION_ENABLED=false
INTERVIEW_FOLLOWUP_ENABLED=true
INTERVIEW_SKILL_COVERAGE_ENABLED=true
INTERVIEW_VAD_ENABLED=true
INTERVIEW_TRANSCRIPT_RETENTION_DAYS=90
```

Candidate career features do not require PyTorch, a local LLM or a paid model. Meeting transcription remains an optional separate worker and is consent-gated with retention and deletion policies before activation.
