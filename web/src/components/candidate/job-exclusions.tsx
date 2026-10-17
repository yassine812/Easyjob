'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { careerApi } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Busy, Failure } from './career-shared';

export function JobExclusions({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const t = useCareerText();
  const [input, setInput] = useState(''), [keyword, setKeyword] = useState(''), [page, setPage] = useState(1);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const jobs = useQuery({ queryKey: ['career-exclusion-picker', keyword, page], queryFn: () => careerApi.jobs({ keyword, page, limit: 10 }) });
  return <fieldset className="space-y-3"><legend className="text-sm font-medium">{t('excludedJobs')}</legend><p className="text-xs text-muted-foreground">{t('excludedJobsHelp')}</p><div className="flex gap-2"><Input aria-label={t('keyword')} value={input} onChange={e => setInput(e.target.value)} /><Button type="button" variant="outline" onClick={() => { setKeyword(input); setPage(1); }}>{t('search')}</Button></div>
    {!!selected.length && <ul className="flex flex-wrap gap-2">{selected.map(id => <li key={id}><Button type="button" variant="secondary" size="sm" onClick={() => onToggle(id)}>{labels[id] || jobs.data?.items.find(j => j.id === id)?.title || t('excludedJobs')} · {t('removeExclusion')}</Button></li>)}</ul>}
     {jobs.isPending ? <Busy /> : jobs.isError ? <Failure retry={() => jobs.refetch()} /> : jobs.data.items.length ? <><ul className="max-h-64 divide-y overflow-y-auto rounded-xl border px-3">{jobs.data.items.map(job => <li key={job.id} className="flex items-center justify-between gap-3 py-3"><span className="text-sm">{job.title}<span className="block text-xs text-muted-foreground">{job.company?.commercialName || t('companyNotListed')}</span></span><Button type="button" size="sm" variant={selected.includes(job.id) ? 'secondary' : 'outline'} onClick={() => { setLabels(v => ({ ...v, [job.id]: job.title })); onToggle(job.id); }}>{t(selected.includes(job.id) ? 'removeExclusion' : 'exclude')}</Button></li>)}</ul><div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('previous')}</Button><Button type="button" size="sm" variant="ghost" disabled={page * jobs.data.limit >= jobs.data.total} onClick={() => setPage(p => p + 1)}>{t('next')}</Button></div></> : <p className="text-sm text-muted-foreground">{t('emptyJobs')}</p>}
  </fieldset>;
}
