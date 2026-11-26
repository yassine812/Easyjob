// Import into the same catalogue read by candidate search. No seed/demo jobs.
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { JobAggregationService } = require('../dist/jobs/job-aggregation.service');
const { CompanyCareersAdapter } = require('../dist/jobs/sources/company-careers.adapter');

async function main() {
  const adapter = new CompanyCareersAdapter(new ConfigService());
  if (process.argv.includes('--probe')) {
    const result = await adapter.fetchJobs();
    console.log(JSON.stringify({ count: result.jobs.length, complete: result.complete, rejected: result.rejected, employers: adapter.reports }, null, 2));
    return;
  }
  const prisma = new PrismaService();
  const service = new JobAggregationService(prisma, {}, {}, {}, {}, {}, { adapters: [adapter] });
  try {
    const result = await service.syncSource(adapter.type);
    const report = { checkedAt: new Date().toISOString(), result, employers: adapter.reports };
    const directory = path.join(__dirname, '../.runtime');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'company-careers-last-sync.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (result.status !== 'ACTIVE') process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error.code || error.message || 'Company career synchronization failed'); process.exitCode = 1; });
