import { CvStudioRoute } from '@/components/candidate/cv-studio/studio-route';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CvStudioRoute resumeId={id} mode="manual" />; }
