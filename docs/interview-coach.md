# Conversational interview practice

The preparation page is informational. Only Start opens device selection;
only selecting camera + microphone or microphone only requests access.
Denied camera access never removes the microphone-only option.

## Active room

The full-screen room reuses EasyJobCharacter and its existing poses. Browser
speech synthesis reads questions with boundary-driven captions; recognition
starts automatically after playback. Recognition segments restart without
submitting the answer. Local audio levels and transcript events require 6.5
seconds of silence before automatic submission. The explicit finish control
remains available. Coding never auto-submits on silence: code and explanation
are submitted together. Arbitrary candidate code is not executed.

Unsupported/failed dictation reveals a typed fallback. Browser dictation may
use the browser vendor's speech service. Audio/video are not stored by EasyJob.
Camera preview and framing checks remain local. After three successive missed
visibility checks, a small framing hint is shown. No camera data influences
answer analysis; gaze, posture, clothing, identity and emotion are not scored.

## Server state and evidence

The existing CoachSession JSON fields persist a vacancy-specific rubric and
conversation state: READY, INTERVIEWER_SPEAKING, LISTENING, ANSWERING,
ANALYZING, INTERVIEWER_FEEDBACK, COMPLETED. No migration is required.

PATCH /career/coach/:id/turn checkpoints transcription/code with ownership,
current-question and optimistic concurrency checks. Submission first persists
ANALYZING and a pending payload. The answer, question, transcript, code,
structured analysis and follow-up decision are saved together. An interrupted
analysis can be replayed; identical completed submissions are idempotent.
Draft writes cannot overwrite pending analysis. Refresh restores the turn,
requiring device selection again before listening resumes.

The rubric includes actual job requirements, importance, seniority, company,
role and CV evidence. Every answer is analyzed before choosing the next turn.
Model feedback supplies five named content metrics, strengths, missing points,
claims and a contextual probe. Unavailable or malformed model analysis uses
guided practice with null scores, never invented percentages. A brief answer
can trigger a clarification quoting it. Follow-ups are inserted immediately,
limited to one per topic and three per session. Brief feedback lasts 2.5
seconds; detailed coaching is reserved for the final report.

## Runtime and verification

The configured AI provider, OPENAI_MODEL and server-side OPENAI_API_KEY are
reused. Public company identity is used for optional research, without the CV.
CV context and responses go only to the configured coaching provider. Sources
are treated as untrusted data. Rebuild/restart the API and restart Python after
backend changes; HTTPS or localhost is required for microphone access.

Regression tests cover automatic speech/listening, captions, feedback
advancement, error preservation, interrupted analysis, silence/coding behavior,
rubric weighting, invalid scores, bounded probes, ownership, stale drafts and
idempotency. Browser visual checks use a temporary isolated fixture without
real devices or candidate data. Actual microphone quality and permission/
autoplay behavior still require a device-capable browser check.
