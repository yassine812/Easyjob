'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowUpRight } from 'lucide-react';
import { workspaceApi } from '@/lib/api/company-workspace';
import { useCompanyText } from '@/lib/i18n/company';
import { useUxText } from '@/lib/i18n/ux';
import { useCompanyRole } from '@/hooks/use-company';
import { useRole } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCommandShortcut } from '@/components/layout/navigation-search';
import { WorkspaceError, WorkspaceLoading } from './workspace-overview';
export function CompanySearch({ companyId }: { companyId: string }) {
  const role = useCompanyRole(companyId);
  const t = useCompanyText(), ux = useUxText(), { can } = useRole();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(''), [q, setQ] = useState('');
  useCommandShortcut(() => setOpen(true));
  useEffect(() => { const timer = setTimeout(() => setQ(draft.trim()), 250); return () => clearTimeout(timer); }, [draft]);
  const result = useQuery({ queryKey: ['company-workspace', companyId, 'search', q], queryFn: () => workspaceApi.search(companyId, q), enabled: open && q.length >= 2 });
  const link = (href: string, label: string, key: string) => <Link key={key} href={`/company/${companyId}/${href}`} onClick={() => setOpen(false)} className="workspace-nav-item justify-between"><span className="truncate">{label}</span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link>;
  const actions = ([
    ['jobs/new', 'postJob', 'job.create'], ['candidates', 'searchCandidates', 'candidate.view'],
    ['interviews?compose=1', 'schedule', 'interview.create'], ['applications', 'applications', 'application.view'], ['team', 'invite', 'team.invite'],
  ] as const).filter(([, , permission]) => can(companyId, permission) && !(permission === 'interview.create' && role === 'INTERVIEWER'));
  return <><Button variant="ghost" onClick={() => setOpen(true)} aria-label={ux('search')} className="text-muted-foreground"><Search className="size-4" /><span className="hidden xl:inline">{t('search')}</span><kbd className="ms-4 hidden rounded border px-1.5 py-0.5 text-[10px] xl:inline">Ctrl K</kbd></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{ux('search')}</DialogTitle><DialogDescription>{ux('searchHelp')}</DialogDescription></DialogHeader><Input value={draft} onChange={e => setDraft(e.target.value)} aria-label={t('search')} placeholder={ux('searchHint')} autoFocus />{draft.trim().length < 2 ? <section><h3 className="mb-2 text-xs font-semibold text-muted-foreground">{ux('quickActions')}</h3>{actions.map(([href, key]) => link(href, t(key), href))}</section> : q !== draft.trim() || result.isPending ? <WorkspaceLoading /> : result.isError ? <WorkspaceError retry={() => void result.refetch()} /> : result.data && <div className="max-h-[50vh] space-y-3 overflow-y-auto" aria-live="polite">{[['job', result.data.jobs.map(j => link(`jobs/${j.id}`, j.title, j.id))], ['candidates', result.data.candidates.map(c => link(`candidates/${c.id}`, c.user.name, c.id))], ['applications', result.data.applications.map(a => link(`applications/${a.id}`, `${a.candidateName} · ${a.jobTitle}`, a.id))], ['interviews', result.data.interviews.map(i => link('interviews', `${i.application.candidate.user.name} · ${new Date(i.startAt).toLocaleString()}`, i.id))], ['team', result.data.members.map(m => link('team', m.user.name, m.id))]].filter(([, rows]) => (rows as React.ReactNode[]).length > 0).map(([key, rows]) => <section key={String(key)}><h3 className="px-3 text-xs font-semibold text-muted-foreground">{t(String(key))}</h3>{rows}</section>)}{Object.values(result.data).every(rows => Array.isArray(rows) && rows.length === 0) && <p className="py-8 text-center text-sm text-muted-foreground">{ux('noResults')}</p>}</div>}</DialogContent></Dialog></>;
}
