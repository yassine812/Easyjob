// Deployed worker probe. No secrets or candidate data are printed.
const fs = require('node:fs');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');
const deadline = setTimeout(() => process.exit(1), 12000);
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
const queue = new Queue('job-sources', { connection: redis });
const prisma = new PrismaClient();
(async () => {
  const heartbeat = JSON.parse(fs.readFileSync('/tmp/easyjob-worker-heartbeat.json', 'utf8'));
  if (Date.now() - heartbeat.at > 120000) throw Error('Worker heartbeat is stale');
  process.kill(heartbeat.pid, 0);
  for (const type of ['COMPANY_DIRECT', 'TANITJOBS']) {
    if (process.env[`JOB_SOURCE_${type}_ENABLED`] === 'false') continue;
    const scheduler = await queue.getJobScheduler(`easyjob-source-${type}`);
    if (!scheduler || Number(scheduler.every) !== 86400000) throw Error(`${type}: daily schedule missing`);
    const source = await prisma.jobSource.findUnique({ where: { type }, select: { lastSyncAt: true } });
    if (source?.lastSyncAt && Date.now() - source.lastSyncAt.getTime() > 36 * 3600000) throw Error(`${type}: collection has not succeeded for 36 hours`);
    if (!source?.lastSyncAt && Date.now() - heartbeat.startedAt > 1800000) throw Error(`${type}: first collection missing`);
  }
  console.log('Worker heartbeat and daily employer/Tanitjobs schedulers OK');
})().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await queue.close(); redis.disconnect(); clearTimeout(deadline); });
