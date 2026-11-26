// Manual maintenance command. Daily collection normally runs through BullMQ.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { JobAggregationService } = require('../dist/jobs/job-aggregation.service');
const { TanitJobsAdapter } = require('../dist/jobs/sources/tanitjobs.adapter');
const adapter = new TanitJobsAdapter(new ConfigService());
const prisma = new PrismaService();
const service = new JobAggregationService(prisma, {}, {}, {}, {}, {}, { adapters: [adapter] });
(async () => {
  const result = process.argv.includes('--probe') ? await adapter.fetchJobs() : await service.syncSource(adapter.type);
  const report = { checkedAt: new Date().toISOString(), ...result };
  const directory = require('node:path').join(__dirname, '../.runtime');
  require('node:fs').mkdirSync(directory, { recursive: true });
  require('node:fs').writeFileSync(require('node:path').join(directory, 'tanitjobs-last-sync.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify('jobs' in result ? { count: result.jobs.length, total: result.total, complete: result.complete, rejected: result.rejected, warnings: result.warnings } : report, null, 2));
  if ('status' in result && result.status !== 'ACTIVE') process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
