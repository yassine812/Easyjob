# Third-party notices

EasyJob integrates the optional public-research capability layer from [Agent Reach](https://github.com/Panniantong/Agent-Reach), pinned to upstream commit `94f06c1969dfc1834001269d79d3ad0972d9dee6`.

Agent Reach is distributed under the MIT License. EasyJob does not bundle its browser automation, cookies, login sessions or provider credentials. The integration is disabled by default and uses only the public web, public GitHub metadata and public RSS sources when explicitly enabled. Upstream health is checked through `agent-reach doctor --json`.

EasyJob also supports optional browser evidence enrichment through [REA](https://github.com/morluto/rea), distributed under the MIT License. REA runs in the protected research worker and is disabled by default. It receives only validated public URLs already selected by the Agent Reach research flow; no cookies, sessions, credentials or candidate data are forwarded. REA's own third-party analysis engines remain subject to their respective licenses.

The optional meeting transcription worker uses [faster-whisper](https://github.com/SYSTRAN/faster-whisper) and its bundled Silero VAD integration. They are self-hosted components; model files have their own upstream model licenses and must be reviewed before redistribution. EasyJob does not ship a model or download one at runtime.

EasyJob also reuses product ideas from [career-ops](https://github.com/career-ops-hq/career-ops), audited at upstream commit `2bebe32826d6f504652fb473c22e4df7124972a`. The repository advertises the MIT License. EasyJob does not bundle or execute career-ops; its candidate workflows were independently implemented in the existing EasyJob Skills runtime with deterministic local rules. No career-ops runtime, Claude/Codex/OpenAI/Gemini provider, paid API or SaaS is required.
