import { CvDetails } from '@/components/candidate/cv-workspace';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CvDetails id={id} />;
}
