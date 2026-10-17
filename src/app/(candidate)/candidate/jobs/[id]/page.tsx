import { CareerJobDetail } from '@/components/candidate/career-job-detail';

export default async function Page({ searchParams }: { searchParams: Promise<{ apply?: string; resumeId?: string }> }) {
  const search = await searchParams;
  return <CareerJobDetail autoOpen={search.apply === '1'} initialResumeId={search.resumeId} />;
}
