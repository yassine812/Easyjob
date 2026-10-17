import { redirect } from 'next/navigation';

/** Legacy deep link: ATS is contextual to a selected CV. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const resumeId = typeof query.resumeId === 'string' ? query.resumeId : null;
  if (resumeId) redirect(`/candidate/cvs/${encodeURIComponent(resumeId)}?tab=ats`);
  redirect('/candidate/cvs');
}
