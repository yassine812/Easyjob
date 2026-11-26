// Optional local Parlor sidecar lifecycle. Parlor is Apache-2.0 and downloads
// its model on first start; it is intentionally not part of the web bundle.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const checkout = path.join(root, '.runtime', 'parlor-upstream');
const repo = 'https://github.com/fikrikarim/parlor.git';
// The CV/face service owns 8000 in local development.
const port = process.env.PARLOR_PORT || '8001';

function run(exe, args) {
  const result = spawnSync(exe, args, { cwd: root, windowsHide: true, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${exe} failed (${result.status ?? result.error?.code})`);
}

function setup() {
  fs.mkdirSync(path.dirname(checkout), { recursive: true });
  if (!fs.existsSync(path.join(checkout, '.git'))) run('git', ['clone', '--depth', '1', repo, checkout]);
  console.log(`Parlor checkout ready: ${checkout}`);
  console.log('Next: npm run parlor:start (first start downloads the local model and TTS assets).');
}

function start() {
  if (!fs.existsSync(path.join(checkout, 'pyproject.toml'))) throw new Error('Run npm run parlor:setup first.');
  const child = spawn(process.env.PARLOR_RUNNER || 'uv', ['run', 'parlor'], {
    cwd: checkout,
    env: { ...process.env, PORT: port },
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('exit', code => { process.exitCode = code ?? 0; });
}

const action = process.argv[2] || 'setup';
try {
  if (action === 'setup') setup();
  else if (action === 'start') start();
  else if (action === 'status') console.log(fs.existsSync(path.join(checkout, 'pyproject.toml')) ? `Parlor is installed at ${checkout}` : 'Parlor is not installed. Run npm run parlor:setup.');
  else throw new Error('Supported: setup | start | status');
} catch (error) { console.error(error.message); process.exitCode = 1; }
