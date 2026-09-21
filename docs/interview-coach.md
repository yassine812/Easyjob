# Guided interview practice

The candidate coach has three steps: job context, preparation and private practice.
The website field disambiguates company names. An EasyJob company's registered
website takes precedence. External jobs can include a pasted description.

Camera/microphone access is requested only by the permission button. Video and
the microphone level meter stay in the browser. Face API models already shipped
with the app provide a free local framing/gaze-direction cue while the preview
is open; no face frame is uploaded for that cue. Tracks stop when the candidate
leaves or completes the session; late permission responses are also released.
The microphone-only option and typed answers remain available. Optional browser
dictation uses the browser's Web Speech service (free to the candidate and
typically cloud-backed by the browser vendor); the UI discloses this and shows
interim words immediately. A browser without SpeechRecognition can still use
the text box.
Only submitted text is saved, not video/audio. Advice covers eye line, posture,
clothing and surroundings; no emotion or appearance scoring is performed.

## Company research and providers

Python uses the OpenAI Responses web search tool, with public company identity
and role title only. Candidate CV/profile data is not included in web research.
Facts are shown with the returned URL citations and research date. The briefing
is supplied as untrusted evidence to question generation. Demo companies are
labelled and do not receive fabricated business news.

- `OPENAI_API_KEY`: existing server-side provider credential.
- `OPENAI_RESEARCH_MODEL`: optional research model (default `gpt-4.1-mini`).
- `OPENAI_MODEL`: existing interview question/feedback model.
- Research requires the official OpenAI API endpoint. Compatible custom endpoints
  continue to support ordinary questions, but skip unsupported web research.
- Research is bounded to 11 seconds, question/feedback generation to 12 seconds.
  Quota, connection or malformed-result failures use explicitly labelled guided
  practice; no unavailable research is presented as successful research.
- An absent official website skips research to avoid conflating namesakes.

References: [OpenAI web search and citation format](https://developers.openai.com/api/docs/guides/tools-web-search).

## Deployment

Apply Prisma migrations and regenerate its client before restarting the API.
`20260912000200_coach_preparation` adds a JSON preparation snapshot without
changing existing session answers. Restart the Python AI service and rebuild
the Next application. HTTPS (or localhost) is required for media permissions.
Speech recognition availability and spoken-question autoplay depend on the
browser; manual playback and typing are provided.
