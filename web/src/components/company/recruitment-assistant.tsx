'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
export function RecruitmentAssistant({ companyId, jobId, applicationId, defaultTask = 'job', initialInstruction = '', onApply }: { companyId: string; jobId?: string; applicationId?: string; defaultTask?: string; initialInstruction?: string; onApply?: (content: string) => void }) {
  const t = useCompanyText(); const { locale } = useI18n(); const [open, setOpen] = useState(false); const [task, setTask] = useState(defaultTask); const [instruction, setInstruction] = useState(''); const [content, setContent] = useState('');
  const mutation = useMutation({ mutationFn: () => api.post<{ content: string; questions?: string[] }>(`/companies/${companyId}/workspace/ai`, { task, jobId, applicationId, locale, instruction: instruction || initialInstruction }), onSuccess: result => setContent(task === 'questions' ? (result.questions ?? []).join('\n\n') : result.content) });
  return <section className="ai-surface p-4"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(o => !o)}><Sparkles className="size-4 text-primary" />{t('aiAssistant')}</Button>{open && <div className="mt-4 space-y-3"><p className="text-xs leading-5 text-muted-foreground">{t('aiHelp')}</p><select value={task} onChange={e => setTask(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label={t('action')}>{['job', 'skills', 'criteria', 'questions', 'message', 'assessment', 'insights'].map(k => <option key={k} value={k}>{t(`ai_${k}`)}</option>)}</select><Textarea value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={5000} placeholder={initialInstruction || t('aiInstruction')} aria-label={t('aiInstruction')} /><Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{t(mutation.isPending ? 'generating' : 'generate')}</Button>{mutation.isError && <p role="alert" className="text-sm text-destructive">{t('aiUnavailable')}</p>}{content && <><label className="grid gap-2 text-sm">{t('aiProposal')}<Textarea rows={10} value={content} onChange={e => setContent(e.target.value)} /></label>{onApply && <Button type="button" variant="outline" onClick={() => onApply(content)}>{t('useProposal')}</Button>}</>}</div>}</section>;
}
