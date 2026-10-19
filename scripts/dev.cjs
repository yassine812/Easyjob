const { spawn } = require('node:child_process');
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const host = 'localhost';
const configuredPort = Number(process.env.WEB_PORT || process.env.PORT || 3000);
const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536 ? configuredPort : 3000;

function probe() {
  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ occupied: true, easyjob: false, status: 0 }), 1800);
    const request = http.get({ host, port, path: '/login', timeout: 1200 }, response => {
      // Next sends this header before streaming the page. Do not wait for the
      // full body: a compiling or half-shut server must still be recognized as
      // the project's own frontend so we can report it accurately.
      if (response.headers['x-powered-by'] === 'Next.js') {
        response.resume();
        finish({ occupied: true, easyjob: true, status: response.statusCode });
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { if (body.length < 4096) body += chunk; });
      response.on('end', () => finish({ occupied: true, easyjob: body.includes('_next/'), status: response.statusCode }));
    });
    request.on('timeout', () => { request.destroy(); finish({ occupied: true, easyjob: false, status: 0 }); });
    request.on('error', error => finish({ occupied: error.code === 'ECONNREFUSED' ? false : true, easyjob: false, status: 0 }));
  });
}

function releaseStaleProductionApi() {
  // The local development contract reserves host port 3000 for Next.js. Older
  // compose containers used to publish the production API on that port and
  // can survive a Docker Desktop restart. Remove only that known container;
  // never touch an unrelated process occupying the port.
  const listed = spawnSync('docker', ['ps', '--filter', 'name=^/startup-starter-prod-api-1$', '--format', '{{.Names}}'], { encoding: 'utf8', windowsHide: true });
  if (listed.status !== 0 || listed.error || listed.stdout.trim() !== 'startup-starter-prod-api-1') return false;
  const removed = spawnSync('docker', ['rm', '-f', 'startup-starter-prod-api-1'], { encoding: 'utf8', windowsHide: true });
  if (removed.status === 0) {
    console.log('Stopped the stale startup-starter production API container so Next.js can use port 3000.');
    return true;
  }
  return false;
}

function findProjectFrontendPid() {
  if (process.platform !== 'win32') return null;
  const listeners = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
  if (listeners.status !== 0 || listeners.error) return null;
  const pids = new Set();
  for (const line of listeners.stdout.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const local = parts[1] ?? '';
    if (!local.endsWith(`:${port}`)) continue;
    const pid = parts.at(-1);
    if (/^\d+$/.test(pid ?? '')) pids.add(pid);
  }
  for (const pid of pids) {
    const inspected = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\").CommandLine`], { encoding: 'utf8', windowsHide: true });
    const commandLine = inspected.stdout ?? '';
    if (/node_modules[\\/]next[\\/]dist[\\/](server|bin)[\\/]/i.test(commandLine)) return pid;
  }
  return null;
}

function releaseStaleProjectFrontend() {
  const pid = findProjectFrontendPid();
  if (!pid) return false;
  const stopped = spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { encoding: 'utf8', windowsHide: true });
  if (stopped.status === 0) {
    console.log(`Stopped the stale EasyJob frontend process (${pid}) so it can restart cleanly on port ${port}.`);
    return true;
  }
  return false;
}

async function main() {
  const current = await probe();
  if (current.occupied && current.easyjob) {
    console.log(`EasyJob frontend is already running at http://localhost:${port}.`);
    console.log('Reuse that tab, or stop the existing frontend before starting a new one.');
    return;
  }
  if (current.occupied && releaseStaleProductionApi()) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const freed = await probe();
    if (!freed.occupied) return main();
  }
  if (current.occupied && releaseStaleProjectFrontend()) {
    await new Promise(resolve => setTimeout(resolve, 400));
    return main();
  }
  if (current.occupied) {
    console.error(`Port ${port} is already occupied by another service (HTTP ${current.status || 'unavailable'}). Stop that service or choose a different port.`);
    process.exitCode = 1;
    return;
  }

  // Prefer the root install, but fall back to the complete frontend install.
  // A partially interrupted npm install can leave root/node_modules/next as an
  // empty directory while web/node_modules/next remains usable.
  const nextCandidates = [
    path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next'),
    path.join(__dirname, '..', 'web', 'node_modules', 'next', 'dist', 'bin', 'next'),
  ];
  const nextBin = nextCandidates.find(candidate => fs.existsSync(candidate));
  if (!nextBin) {
    console.error('Next.js is not installed. Run npm install from the project root.');
    process.exitCode = 1;
    return;
  }
  // Webpack is used for the local dev server because Turbopack's PostCSS
  // worker can remain hung while evaluating the large global stylesheet.
  // Production builds continue to use Next's default Turbopack pipeline.
  const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '-p', String(port)], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: false,
  });
  child.on('exit', (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
  child.on('error', error => { console.error(`Could not start Next.js: ${error.message}`); process.exitCode = 1; });
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { probe, releaseStaleProductionApi, releaseStaleProjectFrontend };
