# EasyJob Meeting transcription

The meeting media path remains independent from transcription:

```text
EasyJob Meeting -> temporary audio chunk -> AI service transcription worker
                 -> Silero VAD (inside faster-whisper) -> transcript segments
                 -> InterviewTranscriptSegment -> EasyJob Skills
```

The FastAPI AI service is a separate process/container from NestJS and is the transcription worker for V1. It uses `faster-whisper` with local model files only. `vad_filter=true` enables faster-whisper's bundled Silero VAD path; if VAD is disabled, transcription still runs. The browser never talks to this worker directly.

Required runtime configuration:

```text
INTERVIEW_TRANSCRIPTION_ENABLED=false
INTERVIEW_VAD_ENABLED=true
FASTER_WHISPER_MODEL_PATH=/models/faster-whisper-small
INTERVIEW_TRANSCRIPT_RETENTION_DAYS=90
```

The model directory must be mounted or materialised at build time. No model download is performed at runtime. CPU mode is the default (`device=cpu`, `compute_type=int8`); a future GPU worker can override that implementation without changing the NestJS contract.

Consent is checked for every participant before inference and again before persistence. Refusing or revoking consent leaves video, audio and manual notes usable. Raw audio is temporary and deleted after inference. Transcript rows are deleted by the scheduled retention job. Transcripts are used only for professional evidence, follow-up questions, skill coverage and post-interview summaries; there is no face, emotion, stress, personality, protected-attribute or automatic hire/reject analysis.

The read-only admin endpoint `GET /api/v1/admin/system/transcription` reports `Healthy`, `Degraded`, `Down` or `Disabled` for transcription, VAD and the worker.

## QA status

The backend and AI service have unit coverage for consent, media validation, bounded inference and unavailable-worker fallback. Playwright MCP remains an external QA harness for the candidate, recruiter, admin and meeting workflows; it is not a runtime dependency and is intentionally not used to automate external sites or bypass anti-bot controls.
