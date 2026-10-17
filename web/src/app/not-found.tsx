'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { recruiterJobsRoute } from '@/lib/job-display';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupportText } from '@/lib/i18n/support';
import { useWorkspace } from '@/hooks/use-workspace';

export default function NotFound() {
  const t = useSupportText();
  const recruitment = useRecruitmentText();
  const pathname = usePathname() || '/';
  const workspace = useWorkspace();
  const companyId = /^\/company\/([^/]+)(?:\/|$)/.exec(pathname)?.[1] ?? (workspace.currentWorkspace === 'recruiter' ? workspace.companyId : undefined);
  const candidate = pathname.startsWith('/candidate/');
  const primaryHref = companyId ? recruiterJobsRoute(decodeURIComponent(companyId)) : candidate ? '/candidate/jobs' : '/jobs';
  const secondaryHref = companyId ? `/company/${companyId}/dashboard` : candidate ? '/candidate/dashboard' : '/';
  return <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 py-16 text-foreground"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,.12),transparent_38%)]" /><section className="relative w-full max-w-xl rounded-3xl border border-border/80 bg-card/90 p-8 text-center shadow-2xl backdrop-blur sm:p-12"><div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-7" /></div><p className="text-sm font-semibold uppercase tracking-[.24em] text-primary">404</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{t('pageNotFound')}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{t('pageNotFoundHelp')}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild><Link href={primaryHref}><ArrowLeft className="me-2 size-4" />{companyId ? recruitment('backToOffers') : t('findJobs')}</Link></Button><Button asChild variant="outline"><Link href={secondaryHref}>{companyId || candidate ? t('backDashboard') : t('backHome')}</Link></Button></div></section></main>;
}
