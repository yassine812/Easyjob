'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import { useQuery } from '@tanstack/react-query';

import { careerApi } from '@/lib/api/career';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useCareerText } from '@/lib/i18n/career';

export function ApplicationPreparation({ jobId }: { jobId: string }) {
  const t = useCareerText();
  const query = useQuery({ queryKey: ['application-preparation', jobId], queryFn: () => careerApi.preparation(jobId) });
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Préparation de votre dossier…</p>;
  if (query.isError) return <Button variant="outline" onClick={() => void query.refetch()}>Réessayer la préparation</Button>;
  const data = query.data;
  return <aside className="space-y-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
    <h3 className="flex items-center gap-2 font-semibold"><EasyJobFeatureMark size="sm" className=" text-cyan-500" />Préparer ma candidature <span className="text-xs text-muted-foreground">EasyJob Boost</span></h3>
    <p className="text-sm">CV conseillé : <strong>{data.recommendedResume?.filename || 'Ajoutez votre CV PDF'}</strong>. Le fichier choisi reste inchangé.</p>
    {data.suggestedSummary && <div><p className="text-sm font-medium">Résumé issu de votre profil, à relire</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.suggestedSummary}</p></div>}
    {!!data.relevantExperiences.length && <div><p className="text-sm font-medium">Expériences pertinentes de votre profil</p>{data.relevantExperiences.map((item, index) => <p key={index} className="text-sm text-muted-foreground">{item.title} · {item.company}</p>)}</div>}
    {!!data.interviewTopicCount && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/50 p-3 text-sm"><span>{data.interviewTopicCount} {t('interviewTopicsIdentified')}</span><Button asChild variant="outline" size="sm"><Link href="/candidate/interview-coach">{t('prepareInterview')}</Link></Button></div>}
    <ul className="space-y-1 text-xs text-muted-foreground">{data.checklist.map(item => <li key={item}>• {item}</li>)}</ul>
  </aside>;
}
