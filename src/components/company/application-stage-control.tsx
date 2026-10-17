'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { applicationsApi } from '@/lib/api/applications';
import type { Application, ApplicationStatus } from '@/types/api';
import { PIPELINE_ORDER } from '@/lib/constants';
import { isTerminalApplication } from '@/lib/recruitment-presentation';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function nextApplicationStages(status: ApplicationStatus) {
  if (isTerminalApplication(status)) return [];
  return [...PIPELINE_ORDER.filter(next => !['SCREENING', 'ASSESSMENT', 'OFFER'].includes(next) && PIPELINE_ORDER.indexOf(next) > PIPELINE_ORDER.indexOf(status)), 'REJECTED', 'WITHDRAWN'] as ApplicationStatus[];
}
export function ApplicationStageControl({ application, companyId }: { application: Application; companyId: string }) {
  const t = useRecruitmentText(), qc = useQueryClient();
  const [pending, setPending] = useState<ApplicationStatus | null>(null), [reason, setReason] = useState('');
  const needsOverride = (next: ApplicationStatus) => (application.classification === 'LOW_ALIGNMENT' || (application.aiMatchScore != null && application.aiMatchScore < 50)) && ['INTERVIEW', 'OFFER', 'HIRED'].includes(next);
  const mutation = useMutation({ mutationFn: (next: ApplicationStatus) => applicationsApi.updateStatus(application.id, { newStatus: next, source: 'HR', ...(needsOverride(next) ? { alignmentOverride: true, overrideReason: reason.trim() } : {}) }), onSuccess: () => {
    setPending(null); setReason('');
    for (const queryKey of [['application', companyId, application.id], ['application-events', companyId, application.id], ['company-applications', companyId], ['application-jobs', companyId], ['company-workspace', companyId]]) void qc.invalidateQueries({ queryKey });
    toast.success(t('updated'));
  }, onError: () => toast.error(t('error')) });
  const stages = nextApplicationStages(application.status);
  if (!stages.length) return <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs">{t(application.status)}</span>;
  return <>
    <Select value={application.status} disabled={mutation.isPending} onValueChange={value => { const next = value as ApplicationStatus; if (isTerminalApplication(next) || needsOverride(next)) { setReason(''); setPending(next); } else mutation.mutate(next); }}>
      <SelectTrigger aria-label={`${t('changeStage')} — ${application.candidate?.user.name ?? ''}`} className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={application.status}>{t(application.status)}</SelectItem>{stages.map(stage => <SelectItem key={stage} value={stage}>{t(stage)}</SelectItem>)}</SelectContent>
    </Select>
    <AlertDialog open={!!pending} onOpenChange={open => { if (!open && !mutation.isPending) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('changeStageConfirm')}</AlertDialogTitle><AlertDialogDescription>{application.candidate?.user.name} · {t(application.status)} → {pending && t(pending)}. {t(pending && needsOverride(pending) ? 'alignmentOverrideHelp' : 'criticalStageHelp')}</AlertDialogDescription></AlertDialogHeader>{pending && needsOverride(pending) && <Textarea aria-label={t('overrideReason')} placeholder={t('overrideReason')} value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} />}<AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>{t('cancel')}</AlertDialogCancel><Button disabled={mutation.isPending || (!!pending && needsOverride(pending) && reason.trim().length < 5)} onClick={() => pending && mutation.mutate(pending)}>{t('confirmStage')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
