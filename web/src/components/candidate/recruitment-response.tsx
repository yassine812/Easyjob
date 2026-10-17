'use client';
import { CandidateEmploymentOffer } from './employment-offer';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useCompanyText } from '@/lib/i18n/company';
import { RequireAuth } from '@/components/shared/guards';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageToggle } from '@/lib/i18n';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { WorkspaceError, WorkspaceLoading } from '@/components/company/workspace-overview';
interface InterviewResponse { id: string; status: string; questions: { items: string[] }; answers: string[] | null; application: { job: { title: string; company: { commercialName: string } } }; }
interface OfferResponse { id: string; title: string; terms: string; status: string; expiresAt: string | null; }
export function RecruitmentResponse({ offer = false }: { offer?: boolean }) { const { id } = useParams<{ id: string }>(); const t = useCompanyText(); return <RequireAuth><main className="min-h-screen bg-muted/20 px-4 py-8"><div className="mx-auto max-w-3xl space-y-6"><header className="flex justify-between"><span className="font-bold">EasyJob</span><div className="flex gap-2"><LanguageToggle /><ThemeToggle /></div></header><h1 className="text-2xl font-semibold">{t(offer ? 'offers' : 'AI')}</h1><div className="rounded-lg border bg-background p-6">{offer ? <CandidateEmploymentOffer id={id} /> : <InterviewContent id={id} />}</div></div></main></RequireAuth>; }
function InterviewContent({ id }: { id: string }) { const t = useCompanyText(); const qc = useQueryClient(); const result = useQuery({ queryKey: ['recruitment-interview', id], queryFn: () => api.get<InterviewResponse>(`/recruitment-interviews/${id}`) }); const [answers, setAnswers] = useState<Record<number, string>>({}); const mutation = useMutation({ mutationFn: () => api.post(`/recruitment-interviews/${id}/answers`, { answers: result.data!.questions.items.map((_, i) => answers[i] ?? '') }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['recruitment-interview', id] }) }); if (result.isPending) return <WorkspaceLoading />; if (result.isError) return <WorkspaceError retry={() => void result.refetch()} />; if (result.data.status === 'COMPLETED') return <p>{t('submitted')}</p>; return <form className="space-y-7" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><p className="text-sm text-muted-foreground">{result.data.application.job.title} · {result.data.application.job.company.commercialName}</p><p className="rounded border p-3 text-sm">{t('interviewDisclosure')}</p>{result.data.questions.items.map((q, i) => <label key={i} className="grid gap-3 text-sm"><span className="font-medium">{i + 1}. {q}</span><Textarea required maxLength={10000} rows={5} value={answers[i] ?? ''} onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))} aria-label={`${t('answer')} ${i + 1}`} /></label>)}{mutation.isError && <p role="alert" className="text-destructive">{t('saveError')}</p>}<Button disabled={mutation.isPending}>{t('submitAnswers')}</Button></form>; }
