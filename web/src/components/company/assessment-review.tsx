'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentsApi } from '@/lib/api/assessments';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AssessmentReview({ companyId, attemptId }: { companyId: string; attemptId: string }) {
  const t = useCompanyText();
  const client = useQueryClient();
  const [marks, setMarks] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['assessment-review', companyId, attemptId], queryFn: () => assessmentsApi.review(attemptId) });
  const save = useMutation({ mutationFn: () => assessmentsApi.grade(companyId, attemptId, Object.entries(marks).map(([questionId, score]) => ({ questionId, score: Number(score) }))),
    onSuccess: async () => { setMarks({}); await client.invalidateQueries({ queryKey: ['assessment-review', companyId, attemptId] }); await client.invalidateQueries({ queryKey: ['assessment-invitations', companyId] }); } });
  if (query.isPending) return <p role="status">{t('loading')}</p>;
  if (query.isError) return <div role="alert">{t('loadError')}<Button onClick={() => query.refetch()}>{t('retry')}</Button></div>;
  const invalid = Object.entries(marks).some(([id, value]) => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > (query.data.answers.find(answer => answer.questionId === id)?.question.points ?? 0));
  return <section className="space-y-4 rounded-lg border p-4"><h3 className="font-semibold">{t('reviewAnswers')} · {query.data.score ?? 0}/{query.data.maxScore ?? 0}</h3>
    <p className="text-sm text-muted-foreground">{t('manualReviewHelp')}</p>
    {query.data.answers.map(answer => <div key={answer.questionId} className="space-y-2 border-b pb-4"><p className="font-medium">{answer.question.prompt}</p><p className="whitespace-pre-wrap text-sm">{answer.answer || '—'}</p><label className="flex items-center gap-3 text-sm">{t('score')} / {answer.question.points}<Input className="w-24" type="number" min={0} max={answer.question.points} step={1} value={marks[answer.questionId] ?? answer.score ?? ''} placeholder="—" onChange={event => setMarks(current => ({ ...current, [answer.questionId]: event.target.value }))} /></label></div>)}
    {save.isError && <p role="alert" className="text-sm text-destructive">{t('saveError')}</p>}
    {save.isSuccess && <p role="status">{t('saved')}</p>}
    <Button disabled={save.isPending || invalid || !Object.keys(marks).length} onClick={() => save.mutate()}>{t('save')}</Button>
  </section>;
}
