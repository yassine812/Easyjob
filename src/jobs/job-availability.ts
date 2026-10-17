import type { Prisma } from '@prisma/client';

export const localTestJobsEnabled = () => process.env.NODE_ENV !== 'production' && process.env.EASYJOB_LOCAL_TEST_JOBS === 'true';
export const isLocalTestJob = (job: { company?: { slug?: string }; description?: string }) =>
  localTestJobsEnabled() && job.company?.slug === 'easyjob-test-lab' && !!job.description?.startsWith('OFFRE DE TEST');

export const availableJobWhere = (): Prisma.JobWhereInput => ({
  status: 'PUBLISHED',
  AND: [{ OR: [
    { NOT: { OR: ['OFFRE DE DÉMONSTRATION', 'OFFRE DE TEST', 'Source officielle et candidature :', 'Source et candidature :'].map(marker => ({ description: { contains: marker, mode: 'insensitive' as const } })) } },
    ...(localTestJobsEnabled() ? [{ company: { slug: 'easyjob-test-lab' }, description: { startsWith: 'OFFRE DE TEST' } }] : []),
  ] }],
  // Reserved example.com domains identify the old fixture companies. Keep their
  // records for admin/company testing, but never expose their jobs to candidates.
  company: { status: 'ACTIVE', verification: { status: 'VERIFIED' }, OR: [{ website: null }, { NOT: { website: { contains: '.example.com', mode: 'insensitive' } } }] },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});
