// A bounded, one-shot import for operators; regular refreshes use the existing BullMQ worker.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { JobAggregationService } = require('../dist/jobs/job-aggregation.service');
const { PartnerSourceRegistry } = require('../dist/jobs/sources/partner-source.registry');
const { JoobleAdapter } = require('../dist/jobs/sources/jooble.adapter');
const { AnetiAdapter } = require('../dist/jobs/sources/aneti.adapter');
const { AnetiInternationalAdapter } = require('../dist/jobs/sources/aneti-international.adapter');
const { TanitJobsAdapter } = require('../dist/jobs/sources/tanitjobs.adapter');
const { LinkedInAdapter } = require('../dist/jobs/sources/linkedin.adapter');

async function main() {
  const config = new ConfigService(), prisma = new PrismaService();
  const registry = new PartnerSourceRegistry(config);
  const source = registry.adapters.find(adapter => adapter.type === 'FREEHIRE');
  if (!source?.isConfigured()) throw new Error('Enable the self-hosted FreeHire settings in backend/.env first.');
  const service = new JobAggregationService(prisma, new JoobleAdapter(), new AnetiAdapter(), new AnetiInternationalAdapter(),
    new TanitJobsAdapter(config), new LinkedInAdapter(config), registry);
  try {
    const result = await service.syncSource('FREEHIRE');
    console.log(JSON.stringify(result));
    if (result.status !== 'ACTIVE') process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error.code || 'FreeHire import failed. Check configuration, backend build and source sync history.'); process.exitCode = 1; });
