// Source-level probe: no credentials or database writes.
require('ts-node/register/transpile-only');
const fs = require('node:fs');
const { ConfigService } = require('@nestjs/config');
const { TanitJobsAdapter } = require('../src/jobs/sources/tanitjobs.adapter');
const adapter = new TanitJobsAdapter(new ConfigService({ JOB_SOURCE_TANITJOBS_ENABLED: 'true' }));
const original = globalThis.fetch;
let requests = 0;
globalThis.fetch = async (...args) => {
  if (++requests % 20 === 1) console.log(`Tanitjobs public catalogue: request ${requests}`);
  return original(...args);
};
adapter.fetchJobs().then(result => {
  fs.mkdirSync('.runtime', { recursive: true });
  fs.writeFileSync('.runtime/tanitjobs-public-probe.json', JSON.stringify({ checkedAt: new Date().toISOString(), requests, ...result }));
  console.log(JSON.stringify({ requests, count: result.jobs.length, open: result.jobs.filter(j => j.status === 'OPEN').length,
    closed: result.jobs.filter(j => j.status !== 'OPEN').length, total: result.total, complete: result.complete, rejected: result.rejected, warnings: result.warnings }));
}).catch(error => { console.error(error.message); process.exitCode = 1; });
