const { spawn } = require('node:child_process');
if (!['true', '1'].includes(String(process.env.EXTERNAL_RESEARCH_ENABLED || '').toLowerCase()) || !['true', '1'].includes(String(process.env.AGENT_REACH_ENABLED || '').toLowerCase())) {
  console.log(JSON.stringify({ ok: true, status: 'disabled' }));
  process.exit(0);
}
const command = process.env.AGENT_REACH_COMMAND || 'agent-reach';
const child = spawn(command, ['doctor', '--json'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let stdout = '';
let stderr = '';
child.stdout.on('data', chunk => { stdout += chunk; });
child.stderr.on('data', chunk => { stderr += chunk; });
child.on('error', error => { console.error(JSON.stringify({ ok: false, detail: error.message })); process.exitCode = 1; });
child.on('close', code => {
  try { console.log(JSON.stringify({ ok: code === 0, command, doctor: JSON.parse(stdout || '{}') })); }
  catch { console.log(JSON.stringify({ ok: false, command, detail: stderr.slice(0, 500) || 'invalid doctor output' })); }
  process.exitCode = code === 0 ? 0 : 1;
});
