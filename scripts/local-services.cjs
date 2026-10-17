// Windows development service supervisor. No credentials or biometric data are logged.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.runtime');
const supervisorUrl = 'http://127.0.0.1:3019';
const endpoints = ['http://127.0.0.1:3002/api/v1/health', 'http://127.0.0.1:8000/health/face'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const body = await response.json();
    return body.status === 'ok';
  } catch { return false; }
}
async function status() {
  try {
    const response = await fetch(supervisorUrl, { signal: AbortSignal.timeout(1500) });
    const body = await response.json();
    if (body.workspace !== root || body.service !== 'easyjob-local-services') throw new Error('Supervisor port belongs to another service');
    return body;
  } catch (error) {
    if (error.message === 'Supervisor port belongs to another service') throw error;
    return null;
  }
}
function recover() {
  return new Promise(resolve => {
    const log = fs.openSync(path.join(runtime, 'local-services-recovery.log'), 'a');
    const child = spawn('powershell.exe', ['-NoProfile', '-File', path.join(__dirname, 'start-local-api.ps1'), '-Managed'], {
      cwd: root, windowsHide: true, stdio: ['ignore', log, log],
    });
    fs.closeSync(log);
    child.once('error', () => resolve(false));
    child.once('exit', code => resolve(code === 0));
  });
}
async function supervise() {
  let ready = false, recovering = false, failures = 0;
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ service: 'easyjob-local-services', workspace: root, pid: process.pid, status: ready ? 'ok' : 'starting', recovering }));
  });
  // Binding before starting children makes concurrent npm launches idempotent.
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3019, '127.0.0.1', resolve); });
  fs.writeFileSync(path.join(runtime, 'local-services.pid'), String(process.pid));
  for (;;) {
    ready = (await Promise.all(endpoints.map(probe))).every(Boolean);
    if (!ready) {
      recovering = true;
      console.log(`${new Date().toISOString()} Restoring local API and face service`);
      await recover();
      recovering = false;
      ready = (await Promise.all(endpoints.map(probe))).every(Boolean);
      failures = ready ? 0 : failures + 1;
    } else failures = 0;
    await pause(Math.min(60000, 15000 * Math.max(1, failures)));
  }
}
async function ensure() {
  if (process.platform !== 'win32') throw new Error('Use the Docker Compose stack on non-Windows hosts.');
  fs.mkdirSync(runtime, { recursive: true });
  if (!await status()) {
    const log = fs.openSync(path.join(runtime, 'local-services.log'), 'a');
    const child = spawn(process.execPath, [__filename, '--supervise'], { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
    fs.closeSync(log);
    child.unref();
  }
  // Match the API (5 min) + model (3 min) cold-start windows on low-memory PCs.
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const current = await status();
    if (current?.status === 'ok' && (await Promise.all(endpoints.map(probe))).every(Boolean)) {
      console.log('EasyJob API and face models are ready; automatic service recovery is active.');
      return;
    }
    await pause(1000);
  }
  throw new Error('Local services are not ready. See .runtime/local-services-recovery.log. The frontend was not started with a broken backend.');
}
async function stop() {
  const current = await status();
  if (current && Number.isInteger(current.pid)) process.kill(current.pid);
  console.log('Local service supervision stopped. API/AI processes were left running.');
}
if (require.main === module) (process.argv.includes('--supervise') ? supervise() : process.argv.includes('--stop') ? stop() : ensure()).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
module.exports = { probe };
