'use client';

import { Badge } from '@/components/ui/badge';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { toJobDisplayStatus, type JobDisplayStatus } from '@/lib/job-display';
import { cn } from '@/lib/utils';

const styles: Record<JobDisplayStatus, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  paused: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  draft: 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  closed: 'border-slate-400/25 bg-slate-500/5 text-slate-500 dark:text-slate-400',
};

const labels: Record<JobDisplayStatus, string> = {
  active: 'offerActive',
  paused: 'offerPaused',
  draft: 'offerDraft',
  closed: 'offerClosed',
};

export function JobStatusBadge({ status }: { status: string | null | undefined }) {
  const t = useRecruitmentText();
  const display = toJobDisplayStatus(status);
  return <Badge variant="outline" className={cn('gap-1.5 font-medium', styles[display])}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{t(labels[display])}</Badge>;
}
