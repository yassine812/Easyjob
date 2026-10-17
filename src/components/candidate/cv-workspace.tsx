'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resumesApi } from '@/lib/api/resumes';
import { careerApi, type AtsReport, type ProfileDetails } from '@/lib/api/career';
import { studioApi } from '@/lib/api/cv-studio';
import { Busy, Failure, AtsPanel, PremiumAiAction } from './career-shared';
import { CvPdfViewer } from './cv-pdf-viewer';
import { AtsScoreRing, CvActionsMenu } from './cv-management-actions';
export { CvLibrary } from './cv-library';

const detailTabs = [
  { key: 'preview', label: 'Aperçu' },
  { key: 'ats', label: 'Analyse ATS' },
  { key: 'versions', label: 'Versions' },
] as const;
type DetailTab = typeof detailTabs[number]['key'];
type ReportResult = { report: AtsReport | null; extracted: ProfileDetails | null };
const languageLabel = (language?: string, locale?: string) => ({ fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands', ar: 'العربية' } as Record<string, string>)[language || locale?.slice(0, 2) || ''] || language || locale || '—';

export function CvDetails({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const requestedTab = params.get('tab');
  const tab: DetailTab = detailTabs.some(item => item.key === requestedTab) ? requestedTab as DetailTab : 'preview';
  const cvs = useQuery({
    queryKey: ['resumes'],
    queryFn: resumesApi.list,
    refetchInterval: q => q.state.data?.some(r => r.id === id && ['PENDING', 'PROCESSING'].includes(r.processingStatus)) ? 2500 : false,
  });
  const cv = cvs.data?.find(r => r.id === id);
  const report = useQuery<ReportResult>({
    queryKey: ['career-report', id, cv?.workingDraftId ?? 'published'],
    queryFn: () => cv?.workingDraftId
      ? studioApi.get(cv.workingDraftId).then(draft => ({ report: draft.report, extracted: null }))
      : careerApi.report(id).then(result => ({ report: result.report, extracted: result.extracted })),
    enabled: !!cv && tab === 'ats',
  });
  const versions = useQuery({
    queryKey: ['resume-versions', id],
    queryFn: () => resumesApi.versions(id),
    enabled: !!cv && tab === 'versions',
  });

  if (cvs.isPending) return <Busy />;
  if (cvs.isError) return <Failure retry={() => cvs.refetch()} />;
  if (!cv) return <div className="space-y-4 p-6"><p>Ce CV est introuvable ou a été supprimé.</p><Link href="/candidate/cvs" className="underline">Retour à Mes CV</Link></div>;

  const tabHref = (value: DetailTab) => value === 'preview' ? `/candidate/cvs/${id}` : `/candidate/cvs/${id}?tab=${value}`;
  const pending = ['PENDING', 'PROCESSING'].includes(cv.processingStatus) || ['PENDING', 'PROCESSING'].includes(cv.analysisSummary?.status || '');

  return <div className="mx-auto max-w-[1440px] space-y-5 py-4">
    <Link href="/candidate/cvs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Mes CV</Link>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
      <div className="flex min-w-0 flex-1 items-center gap-4"><AtsScoreRing score={cv.analysisSummary?.score} pending={pending} /><div className="min-w-0"><h1 className="break-words text-xl font-semibold [overflow-wrap:anywhere]">{cv.filename}</h1><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{cv.isPrimary && <span className="inline-flex items-center gap-1 text-primary"><Star className="size-3" />CV principal</span>}<span className="font-medium text-foreground">{languageLabel(cv.language, cv.locale)}{cv.locale && <span className="ms-1 text-muted-foreground">({cv.locale})</span>}</span><span>Modifié le {new Date(cv.updatedAt || cv.createdAt).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span>Version {cv.version}</span>{cv.variants && cv.variants.length > 1 && <span className="inline-flex items-center gap-1" aria-label="Variantes linguistiques">{cv.variants.map((variant, index) => <span key={variant.id}>{index > 0 && <span className="mx-1">·</span>}<Link href={`/candidate/cvs/${variant.id}`} className={variant.current ? 'font-semibold text-primary' : 'hover:text-foreground'}>{variant.language.toUpperCase()}</Link></span>)}</span>}</div></div></div>
      <div className="flex flex-wrap items-center justify-end gap-2"><PremiumAiAction feature="career.builder" href={`/candidate/cvs/${id}/ai`} title="Améliorer avec EasyJob" description="Analyse ton CV, améliore sa clarté et adapte-le davantage au poste ciblé." /><Button disabled={cv.processingStatus !== 'COMPLETED'} onClick={() => router.push(`/candidate/cvs/${id}/edit`)}><Pencil className="me-2 size-4" />Modifier le CV</Button><CvActionsMenu resume={cv} onDeleted={() => router.push('/candidate/cvs')} /></div>
    </header>
    <nav className="flex gap-5 border-b" aria-label="Sections du CV">
      {detailTabs.map(item => <Link key={item.key} href={tabHref(item.key)} aria-current={tab === item.key ? 'page' : undefined} className={`pb-3 text-sm ${tab === item.key ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}</Link>)}
    </nav>
    {tab === 'preview' && <div className="mx-auto max-w-[1150px]"><CvPdfViewer resume={cv} /></div>}
    {tab === 'ats' && (report.isPending ? <Busy /> : report.isError ? <Failure retry={() => report.refetch()} /> : report.data?.report ? <AtsPanel report={report.data.report} profile={report.data.extracted ?? undefined} onImprove={() => router.push(`/candidate/cvs/${id}/ai`)} /> : <p className="py-8 text-sm text-muted-foreground">L’analyse n’est pas encore disponible. Le document original reste accessible dans « Aperçu ».</p>)}
    {tab === 'versions' && <section aria-labelledby="versions-title" className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><div><h2 id="versions-title" className="text-lg font-semibold">Historique des versions</h2><p className="mt-1 text-sm text-muted-foreground">Chaque version est conservée pour comparer ou restaurer ton CV.</p></div><Button asChild variant="outline"><Link href={`/candidate/cvs/${id}/edit`}>Modifier la version actuelle</Link></Button></div><div className="mt-5 divide-y rounded-xl border">{versions.isPending ? <EasyJobLoading label="Chargement de l’historique" /> : versions.isError ? <div className="p-5 text-sm"><p role="alert">Impossible de charger les versions.</p><Button variant="outline" className="mt-3" onClick={() => versions.refetch()}>Réessayer</Button></div> : versions.data?.length ? versions.data.map(version => <article key={version.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><strong className="text-sm">Version {version.version}</strong>{version.current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Actuelle</span>}</div><p className="mt-1 text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString('fr', { dateStyle: 'medium', timeStyle: 'short' })}{version.score != null ? ` · ATS ${version.score}/100` : ''}</p></div><Button asChild size="sm" variant="ghost"><Link href={`/candidate/cvs/${id}?tab=preview`}>Voir le CV</Link></Button></article>) : <p className="p-5 text-sm text-muted-foreground">Aucune version enregistrée.</p>}</div></section>}
  </div>;
}
