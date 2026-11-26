// Integration test: only run against a disposable database whose name ends in _validation.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { JobAggregationService } = require('../dist/jobs/job-aggregation.service');
const { JobSourceSyncScheduler } = require('../dist/jobs/job-source-sync.scheduler');
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_validation')) throw Error('Disposable validation database required');
const db = new PrismaClient();
let snapshot;
const adapter = { type: 'COMPANY_DIRECT', name: 'Lifecycle validation', syncIntervalMs: 86400000,
  isConfigured: () => true, healthCheck: async () => ({ status: 'ACTIVE' }), fetchJobs: async () => snapshot };
const disabled = { isConfigured: () => false };
const service = new JobAggregationService(db, disabled, disabled, disabled, disabled, disabled, { adapters: [adapter] });
const storeListings = service.storeListings.bind(service);
service.storeListings = async (...args) => { try { return await storeListings(...args); } catch (error) { console.error(error); throw error; } };
const checks = [];
const listing = (id, more = {}) => ({ id, title: `Validation ${id}`, companyName: `Employer ${id.split(':')[0]}`,
  sourceLabel: 'Official employer validation fixture',
  description: 'Official detailed description for lifecycle test. '.repeat(8), country: 'TN', location: 'Tunis, Tunisie',
  url: `https://example.org/jobs/${id.replace(':', '-')}`, status: 'OPEN', closingAt: null, ...more });
async function sync(jobs, prefixes) {
  snapshot = { jobs, total: jobs.length, complete: false,
    completedScopes: prefixes.map(prefix => ({ prefix, presentIds: jobs.filter(j => j.id.startsWith(prefix)).map(j => j.id) })) };
  assert.equal((await service.syncSource('COMPANY_DIRECT')).status, 'ACTIVE');
}
async function find(id) { return db.aggregatedJobSource.findFirstOrThrow({ where: { sourceJobId: id }, include: { aggregatedJob: true } }); }
(async () => {
  await sync([listing('a:one'), listing('a:two'), listing('b:one')], ['a:', 'b:']);
  assert.equal(await db.aggregatedJob.count(), 3); checks.push('New postings are imported');
  const initialId = (await find('a:one')).aggregatedJobId;
  await sync([listing('a:one', { title: 'Updated title', description: 'Updated shorter official description' }), listing('a:new')], ['a:']);
  assert.equal((await find('a:one')).aggregatedJobId, initialId);
  assert.equal((await find('a:one')).aggregatedJob.description, 'Updated shorter official description');
  assert.equal((await find('a:two')).status, 'REMOVED');
  assert.equal((await find('a:two')).aggregatedJob.status, 'NO_LONGER_AVAILABLE');
  assert.equal((await find('b:one')).status, 'OPEN');
  assert.equal((await service.search({})).total, 3);
  checks.push('Stable identity, edits, new jobs, same-run removals and outage isolation');
  assert.equal((await db.jobSource.findFirst()).lastExpired, 1);
  await assert.rejects(service.findOpenJob((await find('a:two')).aggregatedJobId));
  checks.push('Removed offers cannot be opened as available or applied to');
  await sync([listing('a:one', { status: 'CLOSED' }), listing('a:new', { closingAt: new Date('2020-01-01') })], ['a:']);
  assert.equal((await service.search({})).total, 1);
  checks.push('Explicit closures and elapsed deadlines are excluded');
  await sync([listing('a:one'), listing('a:new')], ['a:']);
  await sync([listing('a:one'), listing('a:new')], ['a:']);
  assert.equal((await service.search({})).total, 3);
  assert.equal(await db.aggregatedJob.count(), 4);
  assert.equal((await find('a:new')).aggregatedJob.closingAt, null);
  checks.push('Reopening clears obsolete deadlines; repeated runs create no duplicates');
  await sync([], ['a:']);
  assert.equal((await service.search({})).total, 1);
  checks.push('Verified empty employer feed removes its jobs and preserves other employers');
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(`easyjob-validation-${Date.now()}`, { connection: redis });
  try {
    const scheduler = new JobSourceSyncScheduler(queue, { getAdapters: () => [adapter] });
    await scheduler.onModuleInit(); await scheduler.onModuleInit();
    const scheduled = await queue.getJobSchedulers(0, -1, true);
    assert.equal(scheduled.length, 1); assert.equal(Number(scheduled[0].every), 86400000);
    assert.equal(scheduled[0].key, 'easyjob-source-COMPANY_DIRECT');
    assert.equal(await queue.getGlobalConcurrency(), 1);
    await new JobSourceSyncScheduler(queue, { getAdapters: () => [] }).onModuleInit();
    assert.equal((await queue.getJobSchedulers(0, -1, true)).length, 0);
    checks.push('Real Redis: daily schedule survives repeated initialization, serializes runs, and can be disabled');
  } finally { await queue.obliterate({ force: true }); await queue.close(); redis.disconnect(); }
  const report = { checkedAt: new Date().toISOString(), passed: checks.length, checks };
  fs.writeFileSync('/tmp/company-lifecycle-validation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
