# MiroFish recruiter simulation

EasyJob uses [MiroFish](https://github.com/666ghj/MiroFish) as an integrated
server-side swarm recruiter. The Interview Prep page sends a candidate answer
to the NestJS API; the API calls MiroFish's prepared-agent interview endpoint.
Parlor remains the live camera/microphone practice room. They are complementary:
Parlor handles the spoken interaction, while MiroFish estimates how a recruiter
would react to the answer.

MiroFish is licensed under **AGPL-3.0**. Keep its license and source notices
with any public deployment and review the obligations before offering a hosted
modified version.

## It is enabled in the unified stack

1. Create a MiroFish project, graph, prepared simulation and recruiter agent
   using the upstream MiroFish UI/API. MiroFish requires an OpenAI-compatible
   LLM key and a Zep Cloud key for graph memory.
2. Set these values in the same `.env.staging` used by EasyJob. The service
   profile and application flag are already enabled by the production template:

```dotenv
MIROFISH_ENABLED=true
MIROFISH_URL=http://mirofish:5001
MIROFISH_SIMULATION_ID=sim_...
MIROFISH_AGENT_ID=0
MIROFISH_LLM_API_KEY=...
MIROFISH_LLM_BASE_URL=https://api.openai.com/v1
MIROFISH_LLM_MODEL_NAME=gpt-4o-mini
MIROFISH_ZEP_API_KEY=...
```

3. Start the existing deployment normally; the configured profile is included:

```bash
docker compose -f backend/docker-compose.prod.yml --env-file .env.staging up -d --build
```

If the profile is not enabled, or if MiroFish is still preparing a simulation,
the Interview Prep card uses EasyJob's deterministic local recruiter simulation
instead of failing the workflow. No candidate data is sent to MiroFish in that
fallback mode.

MiroFish is internal-only; it is never exposed as a public unauthenticated
endpoint. The API validates candidate ownership before forwarding a request.
