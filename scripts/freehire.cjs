// Local FreeHire lifecycle. Secrets and upstream checkout stay in ignored .runtime/.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const upstream = path.join(root, '.runtime/freehire-upstream');
const envFile = path.join(root, '.runtime/freehire.env');
const revision = '804c174d91fea3d94378967a2c8e2deb7bb1d4e7';
function run(exe, args, capture = false) {
  const result = spawnSync(exe, args, { cwd: root, windowsHide: true, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${exe} failed (${result.status ?? result.error?.code})`);
  return result.stdout?.trim();
}
function compose(...args) { return run('docker', ['compose', '--env-file', envFile, '-f', path.join(root, 'deploy/freehire/compose.yml'), ...args]); }
async function main() {
  const action = process.argv[2] || 'status';
  if (action === 'setup') {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    if (!fs.existsSync(envFile)) fs.writeFileSync(envFile, `FREEHIRE_DB_PASSWORD=${randomBytes(24).toString('hex')}\nFREEHIRE_JWT_SECRET=${randomBytes(32).toString('hex')}\nFREEHIRE_PORT=8085\n`, { mode: 0o600 });
    if (!fs.existsSync(path.join(upstream, '.git'))) {
      run('git', ['clone', '--no-checkout', '--filter=blob:none', 'https://github.com/strelov1/freehire.git', upstream]);
      run('git', ['-C', upstream, 'fetch', '--depth', '1', 'origin', revision]);
      run('git', ['-C', upstream, 'checkout', '--detach', revision]);
    }
    if (run('git', ['-C', upstream, 'rev-parse', 'HEAD'], true) !== revision) throw new Error('Upstream revision differs. Use a separate checkout at the documented revision.');
    if (run('git', ['-C', upstream, 'status', '--porcelain', '--', ':!.dockerignore'], true)) throw new Error('Upstream checkout has local changes; refusing to build an unreviewed revision.');
    compose('build', 'freehire-api');
  } else {
    if (!fs.existsSync(envFile)) throw new Error('Run node scripts/freehire.cjs setup first.');
    if (action === 'start') compose('up', '-d', 'freehire-api', 'collector');
    else if (action === 'stop') compose('stop');
    else if (action === 'status') {
      compose('ps');
      const port = /^FREEHIRE_PORT=(\d+)$/m.exec(fs.readFileSync(envFile, 'utf8'))?.[1] || '8085';
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/jobs?limit=1`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`FreeHire HTTP ${response.status}`);
      const payload = await response.json();
      console.log(`Self-hosted catalogue: ${payload.meta.total} jobs`);
    } else if (action === 'add-board') {
      const [provider, board, company] = process.argv.slice(3);
      if (provider !== 'greenhouse' || !/^[a-zA-Z0-9_-]+$/.test(board || '') || !company) throw new Error('Usage: add-board greenhouse <board-id> "Company name"');
      compose('run', '--rm', '--no-deps', '--entrypoint', '/app/add-board', 'freehire-api', `--provider=${provider}`, `--board=${board}`, `--company=${company}`, '--apply');
    } else if (action === 'collect') compose('run', '--rm', '--no-deps', '--entrypoint', '/app/ingest', 'freehire-api', 'greenhouse');
    else throw new Error('Supported: setup | start | status | add-board | collect | stop');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
