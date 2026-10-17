import { PrismaClient } from '@prisma/client';
import { repairKnownCorruption } from '../src/jobs/sources/public-html';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const [jobs, aggregated] = await Promise.all([
    prisma.job.findMany({ where: { OR: [{ title: { contains: '\uFFFD' } }, { description: { contains: '\uFFFD' } }] }, select: { id: true, title: true, description: true } }),
    prisma.aggregatedJob.findMany({ where: { OR: [{ title: { contains: '\uFFFD' } }, { description: { contains: '\uFFFD' } }] }, select: { id: true, title: true, description: true } }),
  ]);
  const repairedJobs = jobs.map(job => ({ ...job, title: repairKnownCorruption(job.title), description: repairKnownCorruption(job.description) }));
  const repairedAggregated = aggregated.map(job => ({ ...job, title: repairKnownCorruption(job.title), description: repairKnownCorruption(job.description) }));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', jobs: repairedJobs, aggregatedJobs: repairedAggregated }, null, 2));
  if (apply) {
    await prisma.$transaction([
      ...repairedJobs.filter((job, index) => job.title !== jobs[index].title || job.description !== jobs[index].description).map(job => prisma.job.update({ where: { id: job.id }, data: { title: job.title, description: job.description } })),
      ...repairedAggregated.filter((job, index) => job.title !== aggregated[index].title || job.description !== aggregated[index].description).map(job => prisma.aggregatedJob.update({ where: { id: job.id }, data: { title: job.title, description: job.description } })),
    ]);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
