'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { candidatesApi } from '@/lib/api/candidates';
import { careerApi } from '@/lib/api/career';
import { Button } from '@/components/ui/button';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { useCareerText } from '@/lib/i18n/career';
import { useI18n } from '@/lib/i18n';
import { CareerFrame, Failure, panelClass } from './career-shared';
import { SkeletonRows } from '@/components/shared';
import { PageControls } from '@/components/company/recruitment-workspace';

export function SavedJobs() {
  const t = useRecruitmentText(), ct = useCareerText(), { locale } = useI18n(), qc = useQueryClient();
  const [tab, setTab] = useState('all'), [page, setPage] = useState(1);
  const saved = useQuery({ queryKey: ['saved-jobs'], queryFn: () => candidatesApi.savedJobs() });
  const externalSaved = useQuery({ queryKey: ['saved-external-jobs'], queryFn: careerApi.savedExternalJobs });
  const remove = useMutation({ mutationFn: candidatesApi.removeSavedJob, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['saved-jobs'] }); void qc.invalidateQueries({ queryKey: ['career-jobs'] }); void qc.invalidateQueries({ queryKey: ['career-overview'] }); toast.success(t('updated')); }, onError: () => toast.error(t('error')) });
  const removeExternal = useMutation({ mutationFn: careerApi.removeExternalSavedJob, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['saved-external-jobs'] }); void qc.invalidateQueries({ queryKey: ['career-jobs'] }); toast.success(t('updated')); }, onError: () => toast.error(t('error')) });

  const native = (saved.data || []).map(item => ({ ...item, expired: item.job?.status !== 'PUBLISHED' || !!item.job?.expiresAt && new Date(item.job.expiresAt) <= new Date() }))
    .filter(item => tab === 'all' || (tab === 'APPLIED' ? item.applied : item.expired));
  const external = tab === 'all' ? externalSaved.data || [] : [];
  const total = native.length + external.length, start = (page - 1) * 12, end = page * 12;
  const nativePage = native.slice(start, end);
  const externalPage = external.slice(Math.max(0, start - native.length), Math.max(0, end - native.length));

  return <CareerFrame title={t('saved')} description={t('savedHelp')}>
    <div className="flex flex-wrap gap-2">{['all', 'APPLIED', 'EXPIRED'].map(value => <Button key={value} variant={tab === value ? 'default' : 'outline'} onClick={() => { setTab(value); setPage(1); }}>{t(value)}</Button>)}<Button asChild variant="outline"><Link href="/candidate/recommended">{t('recommended')}</Link></Button></div>
    {saved.isPending || externalSaved.isPending ? <SkeletonRows rows={4} cols={3} /> : saved.isError ? <Failure retry={() => saved.refetch()} /> : externalSaved.isError ? <Failure retry={() => externalSaved.refetch()} /> : <>
      <div className="grid gap-4 lg:grid-cols-2">
        {nativePage.map(item => item.job && <article className={`${panelClass} space-y-4`} key={`native-${item.jobId}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{item.job.company?.commercialName}</p><h2 className="mt-1 text-lg font-semibold">{item.job.title}</h2></div><Button variant="ghost" size="icon" aria-label={`${t('removeSaved')} · ${item.job.title}`} disabled={remove.isPending} onClick={() => remove.mutate(item.jobId)}><Trash2 className="size-4" /></Button></div>
          <p className="text-sm text-muted-foreground">{item.job.location} · {t(item.job.employmentType)} · {t(item.job.workMode || (item.job.remote ? 'REMOTE' : 'ONSITE'))}</p>
          <div className="flex flex-wrap gap-2">{item.applied && <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{t('APPLIED')}</span>}{item.expired && <span className="rounded-full bg-muted px-3 py-1 text-xs">{t('EXPIRED')}</span>}</div>
          <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString(locale)}</p>{!item.expired && <Button variant="outline" asChild><Link href={`/candidate/jobs/${item.jobId}`}>{t('view')}</Link></Button>}
        </article>)}
        {externalPage.map(item => <article className={`${panelClass} space-y-4`} key={`external-${item.id}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{item.job.company?.commercialName || ct('companyNotListed')}</p><h2 className="mt-1 text-lg font-semibold">{item.job.title}</h2></div><Button variant="ghost" size="icon" aria-label={`${t('removeSaved')} · ${item.job.title}`} disabled={removeExternal.isPending} onClick={() => removeExternal.mutate(item.job.id)}><Trash2 className="size-4" /></Button></div>
          <p className="text-sm text-muted-foreground">{[item.job.location, item.job.employmentType].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-muted-foreground">{t('source')}: {item.job.sourceReferences?.[0]?.name || '—'} · {new Date(item.createdAt).toLocaleDateString(locale)}</p><Button variant="outline" asChild><Link href={`/candidate/jobs/${item.job.id}`}>{t('view')}</Link></Button>
        </article>)}
        {total === 0 && <div className={`${panelClass} col-span-full py-14 text-center`}><Bookmark className="mx-auto mb-4 size-8 text-muted-foreground" /><p>{t('noData')}</p></div>}
      </div>
      <PageControls page={page} total={total} limit={12} change={setPage} />
    </>}
  </CareerFrame>;
}
