# EasyJob Meeting

The UI uses `livekit-client` tracks directly. There is no external meeting UI, account or redirect. The existing Nest API authorizes participants; LiveKit is a self-hosted SFU and carries media. Private briefs and notes never enter participant metadata or data channels.

## Local Windows / Docker Desktop

Run from the repository root:

```powershell
node deploy/meeting/prepare-local.cjs
docker compose -f deploy/meeting/docker-compose.yml up -d
npx prisma migrate deploy
npx prisma generate
npm run build
```

Restart the API on 3002. The web app remains on **3000**. Credentials live in ignored `.env` and `.runtime/easyjob-meeting/livekit.yaml`. HTTP 7880 and media TCP 7881 / UDP 7882 are bound to loopback: this configuration is deliberately for browsers on this machine. Do not use it for LAN access. The SFU webhook calls the host API via Docker Desktop's `host.docker.internal`; it verifies the raw-body signature before processing events.

`/meetings/:id` remains the shared authenticated route in existing invitations. The API determines the candidate/interviewer view and authorization. Role-specific aliases are unnecessary. New rooms are named `ej-int-<uuid>`; existing room IDs remain stable after migration. No provider URL is stored or emailed.

## Public server, when supplied

Use a dedicated Linux VM with a public IP, Docker host networking, and the pinned image from compose. Adapt `livekit.production.example.yaml`, supply private credentials and mount the TURN certificate read-only. Redis should be bound to loopback with a password. Put signaling behind a trusted HTTPS reverse proxy: public `wss://meeting.<domain>` to HTTP 7880. Because embedded TURN uses TCP 443 on the media host, place HTTPS termination on a separate ingress IP/host or use an L4 router; do not bind two services to the same address/port.

Allow TCP 443 (TURN TLS), TCP 7881 (ICE fallback), UDP 7882 (media), UDP 3478 (TURN). Set API `LIVEKIT_URL=wss://meeting.<domain>`, `LIVEKIT_INTERNAL_URL` to the private HTTP address, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `EASYJOB_MEETING_ENABLED=true`. Configure the signed webhook URL to the real API. HTTPS is also required for the EasyJob web app outside localhost. Configure the reverse proxy for WebSocket upgrades. Never expose Redis.

References: [LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/), [ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## Lifecycle and validation

Join checks identity, assignment, room type, active status, plan/consent where applicable, and the window from 15 minutes before to 30 minutes after. Join tokens last 60 seconds and contain only room and participant role. Starting requires an actual SFU participant; it persists `IN_PROGRESS` and `startedAt`. Completion persists `COMPLETED` and `endedAt`, and deletes the server room to disconnect everyone. Signed join webhooks evict closed/expired rooms, including replays of old tokens. A 15-second sweep retries eviction after outages. Leaving alone does not complete the interview.

Before public release, test two separate accounts/browsers on different networks: bidirectional audio/video, screen share, mute/camera off, device changes, reconnection, leaving, and ending for all. Also test unrelated-user denial and private-data isolation. Unit tests alone do not establish working WebRTC across NAT. Public-network validation awaits a domain/server.

### Local verification — 7 October 2026

Two independent browser tabs joined the local SFU through the real API using a disposable interview. Synthetic video and audio were published and received in both directions (decoded frames and received audio bytes verified). Mute, camera off, a screen-share track, leaving/rejoining, and server-side completion were exercised. Completion disconnected both participants; `startedAt` and `endedAt` persisted, candidate responses omitted private notes, and subsequent join requests were rejected. The disposable interview was removed afterward.

These checks validate local transport and lifecycle, not physical camera/microphone quality, the OS screen picker, automatic network recovery, or connectivity between different networks. Those checks remain necessary with the eventual public server.
