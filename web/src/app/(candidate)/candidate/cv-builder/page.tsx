import { redirect } from 'next/navigation';

/** Legacy deep link: creation now starts from Mes CV. Preserve an existing CV context when present. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const resumeId = typeof query.resumeId === 'string' ? query.resumeId : null;
  if (resumeId) {
    const jobId = typeof query.jobId === 'string' ? query.jobId : null;
    redirect(`/candidate/cvs/${encodeURIComponent(resumeId)}/ai${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`);
  }
  redirect('/candidate/cvs/create?mode=manual');
}
