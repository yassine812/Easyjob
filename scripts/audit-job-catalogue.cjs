// Read-only local audit. Prints no credentials or candidate data and never fetches a provider.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { ConfigService } = require('@nestjs/config');
const { JobAggregationService } = require('../dist/jobs/job-aggregation.service');
const { PartnerSourceRegistry } = require('../dist/jobs/sources/partner-source.registry');
const { JoobleAdapter } = require('../dist/jobs/sources/jooble.adapter');
const { AnetiAdapter } = require('../dist/jobs/sources/aneti.adapter');
const { AnetiInternationalAdapter } = require('../dist/jobs/sources/aneti-international.adapter');
const { TanitJobsAdapter } = require('../dist/jobs/sources/tanitjobs.adapter');
const { LinkedInAdapter } = require('../dist/jobs/sources/linkedin.adapter');
const { availableJobWhere } = require('../dist/jobs/job-availability');

const prisma = new PrismaClient();
async function main() {
  const config = new ConfigService();
  const aggregation = new JobAggregationService(prisma, new JoobleAdapter(config), new AnetiAdapter(), new AnetiInternationalAdapter(),
    new TanitJobsAdapter(config), new LinkedInAdapter(config), new PartnerSourceRegistry(config));
  const sources = await aggregation.sourceStatuses();
  const catalogue = await aggregation.search({ page: 1, limit: 1 });
  const report = {
    auditedAt: new Date().toISOString(),
    candidateVisibleExternal: catalogue.total,
    candidateEligibleNative: await prisma.job.count({ where: availableJobWhere() }),
    retainedExternalByStatus: await prisma.aggregatedJob.groupBy({ by: ['status'], _count: true }),
    sourceCompanyCount: await prisma.sourceCompany.count(),
    sources: sources.map(({ type, status, enabled, lastSyncAt, listingCount, activeJobs, closedJobs, lastImported, lastUpdated, lastExpired, lastRejected, lastDuplicates }) =>
      ({ type, status, enabled, lastSyncAt, listingCount, storedOpenJobs: activeJobs, storedClosedJobs: closedJobs, lastImported, lastUpdated, lastExpired, lastRejected, lastDuplicates })),
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
main().catch(error => { console.error(`Catalogue audit failed (${error.code || error.name}). Build and migrate first.`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
