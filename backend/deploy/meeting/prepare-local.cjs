// Generates local credentials without printing them or committing them to source control.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const envPath = path.join(root, '.env');
let env = fs.readFileSync(envPath, 'utf8');
const read = name => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const key = read('LIVEKIT_API_KEY') || 'easyjob-local';
const secret = read('LIVEKIT_API_SECRET') || crypto.randomBytes(32).toString('hex');
for (const [name, value] of Object.entries({ EASYJOB_MEETING_ENABLED: 'true', LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_INTERNAL_URL: 'http://127.0.0.1:7880', LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret })) {
  const pattern = new RegExp(`^${name}=.*$`, 'm'); env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : `${env.trimEnd()}\n${name}=${value}\n`;
}
env = env.replace(/^JITSI_.*\r?\n/gm, '');
env = env.replace(/^EASYJOB_MEETING_PROVIDER=.*\r?\n/gm, '');
fs.writeFileSync(envPath, env);
const dir = path.join(root, '.runtime/easyjob-meeting'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'livekit.yaml'), `port: 7880\nbind_addresses: ["0.0.0.0"]\nrtc:\n  tcp_port: 7881\n  udp_port: 7882\n  node_ip: 127.0.0.1\n  use_external_ip: false\nkeys:\n  ${JSON.stringify(key)}: ${JSON.stringify(secret)}\nwebhook:\n  api_key: ${JSON.stringify(key)}\n  urls: ["http://host.docker.internal:3002/api/v1/meetings/events"]\n`);
console.log('Local EasyJob Meeting configured. Restart the API and run docker compose -f deploy/meeting/docker-compose.yml up -d.');
