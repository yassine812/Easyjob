'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { ClipboardList, Copy, Plus, Trash2, X } from 'lucide-react';
import { AssessmentReview } from '@/components/company/assessment-review';
import { jobsApi } from '@/lib/api/jobs';
import { useCompanyText } from '@/lib/i18n/company';
import { assessmentsApi } from '@/lib/api/assessments';
import { applicationsApi } from '@/lib/api/applications';
import { useRole } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api/client';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { PageHeader, EmptyState, ErrorState, PaginationControls } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ASSESSMENT_STATUS_LABELS } from '@/lib/constants';

const questionSchema = z.object({
  prompt: z.string().min(1, 'Question is required'),
  type: z.enum(['MULTIPLE_CHOICE', 'TEXT', 'CODING']),
  points: z.coerce.number().min(0),
  option1: z.string().optional(),
  option2: z.string().optional(),
  option3: z.string().optional(),
  option4: z.string().optional(),
  correctAnswer: z.string().optional(),
});

const schema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().or(z.literal('')),
  type: z.enum(['SKILL', 'BEHAVIORAL', 'TECHNICAL']),
  durationMinutes: z.coerce.number().min(1).max(600).optional().or(z.literal('')),
  questions: z.array(questionSchema),
});

type FormValues = {
  title: string;
  description?: string;
  type: 'SKILL' | 'BEHAVIORAL' | 'TECHNICAL';
  durationMinutes: number | '';
  questions: Array<{
    prompt: string;
    type: 'MULTIPLE_CHOICE' | 'TEXT' | 'CODING';
    points: number | '';
    option1?: string;
    option2?: string;
    option3?: string;
    option4?: string;
    correctAnswer?: string;
  }>;
};

export default function AssessmentsPage() {
  const t = useCompanyText();
  const [jobId, setJobId] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const queryClient = useQueryClient();
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteCandidateId, setInviteCandidateId] = useState('');

  const jobs = useQuery({ queryKey: ['assessment-jobs', companyId], queryFn: () => jobsApi.companyJobs(companyId, { limit: 100 }), enabled: can(companyId, 'assessment.manage') });
  const assessments = useQuery({
    queryKey: ['company-assessments', companyId, { page }],
    queryFn: () => assessmentsApi.list(companyId, { page, limit: 20 }),
    enabled: can(companyId, 'assessment.manage'),
  });
  const applications = useQuery({
    queryKey: ['company-applications', companyId, { page: 1, limit: 100 }],
    queryFn: () => applicationsApi.companyList(companyId, { page: 1, limit: 100 }),
    enabled: can(companyId, 'application.view'),
  });
  const selected = useQuery({
    queryKey: ['company-assessment', companyId, selectedId],
    queryFn: () => assessmentsApi.detail(companyId, selectedId!),
    enabled: !!selectedId,
  });
  const invitations = useQuery({
    queryKey: ['assessment-invitations', companyId, selectedId],
    queryFn: () => assessmentsApi.invitations(companyId, selectedId!),
    enabled: !!selectedId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      title: '',
      description: '',
      type: 'SKILL',
      durationMinutes: 30,
      questions: [{ prompt: '', type: 'MULTIPLE_CHOICE', points: 1, option1: '', option2: '', option3: '', option4: '', correctAnswer: '' }],
    },
  });
  const questionFields = useFieldArray({ control: form.control, name: 'questions' });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      assessmentsApi.create(companyId, {
        jobId: jobId || undefined,
        title: v.title,
        description: v.description || undefined,
        type: v.type,
        durationMinutes: v.durationMinutes === '' ? undefined : Number(v.durationMinutes),
        questions: v.questions
          .filter((q) => q.prompt.trim())
          .map((q) => ({
            prompt: q.prompt,
            type: q.type,
            points: q.points === '' ? 1 : Number(q.points),
            options:
              q.type === 'MULTIPLE_CHOICE'
                ? [q.option1, q.option2, q.option3, q.option4].filter(Boolean).map((o) => ({ label: o!, value: o! }))
                : undefined,
            correctAnswer: q.correctAnswer || undefined,
          })),
      }),
    onSuccess: () => {
      toast.success(t('assessmentCopy21'));
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['company-assessments', companyId] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t('assessmentCopy22')),
  });

  const invite = useMutation({
    mutationFn: (assessmentId: string) =>
      assessmentsApi.invite(companyId, assessmentId, { candidateId: inviteCandidateId }),
    onSuccess: (res) => {
      toast.success(t('assessmentCopy23'));
      setInviteFor(null);
      setInviteCandidateId('');
      queryClient.invalidateQueries({ queryKey: ['assessment-invitations', companyId, selectedId] });
      if (res.token) {
        navigator.clipboard?.writeText(`${window.location.origin}/assessments/attempt/${res.token}`).catch(() => undefined);
      }
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t('assessmentCopy24')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => assessmentsApi.remove(companyId, id),
    onSuccess: () => {
      toast.success(t('assessmentCopy25'));
      if (selectedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['company-assessments', companyId] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t('assessmentCopy26')),
  });

  return (
    <RequireCompanyPermission companyId={companyId} permission="assessment.manage">
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t('assessmentCopy0')} description={t('assessmentCopy1')}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 size-4" /> {t('assessmentCopy2')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('assessmentCopy3')}</DialogTitle>
                <DialogDescription>
                  {t('manualReviewHelp')}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
                  <label className="grid gap-2 text-sm">{t('linkedJob')}<select className="h-10 rounded-md border bg-background px-3" value={jobId} onChange={e => setJobId(e.target.value)}><option value="">{t('reusableAssessment')}</option>{jobs.data?.items.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('assessmentCopy4')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('assessmentCopy38')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('assessmentCopy5')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('assessmentCopy6')}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="SKILL">{t('assessmentCopy7')}</SelectItem>
                              <SelectItem value="BEHAVIORAL">{t('assessmentCopy8')}</SelectItem>
                              <SelectItem value="TECHNICAL">{t('assessmentCopy9')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('assessmentCopy10')}</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={600} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />
                  <p className="text-sm font-medium">{t('assessmentCopy11')}</p>
                  <div className="space-y-4">
                    {questionFields.fields.map((q, qi) => (
                      <div key={q.id} className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">Question {qi + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => questionFields.remove(qi)}
                            aria-label={t('assessmentCopy12')}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                        <Input placeholder={t('assessmentCopy13')} {...form.register(`questions.${qi}.prompt`)} />
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={form.watch(`questions.${qi}.type`)}
                            onValueChange={(v) => form.setValue(`questions.${qi}.type`, v as never)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MULTIPLE_CHOICE">{t('assessmentCopy14')}</SelectItem>
                              <SelectItem value="TEXT">{t('assessmentCopy15')}</SelectItem>
                              <SelectItem value="CODING">{t('assessmentCopy16')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            placeholder={t('assessmentCopy17')}
                            {...form.register(`questions.${qi}.points`)}
                          />
                        </div>
                        {form.watch(`questions.${qi}.type`) === 'MULTIPLE_CHOICE' ? (
                          <div className="grid grid-cols-2 gap-2">
                            {[1, 2, 3, 4].map((n) => (
                              <Input
                                key={n}
                                placeholder={`Option ${n}`}
                                {...form.register(`questions.${qi}.option${n}` as never)}
                              />
                            ))}
                            <Input
                              placeholder={t('assessmentCopy18')}
                              {...form.register(`questions.${qi}.correctAnswer`)}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      questionFields.append({
                        prompt: '',
                        type: 'MULTIPLE_CHOICE',
                        points: 1,
                        option1: '',
                        option2: '',
                        option3: '',
                        option4: '',
                        correctAnswer: '',
                      })
                    }
                  >
                    <Plus className="mr-1 size-3.5" /> {t('assessmentCopy19')}
                  </Button>
                  <DialogFooter>
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? t('assessmentCopy20') : t('assessmentCopy3')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-semibold">{t('assessmentCopy0')}</h2>
            {assessments.isPending ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
                ))}
              </div>
            ) : assessments.isError ? (
              <ErrorState message={t('assessmentCopy27')} retry={() => assessments.refetch()} />
            ) : assessments.data && assessments.data.items.length > 0 ? (
              <div className="space-y-3">
                {assessments.data.items.map((a) => (
                  <Card
                    key={a.id}
                    className={selectedId === a.id ? 'border-primary' : 'cursor-pointer'}
                    onClick={() => { setSelectedId(a.id); setReviewId(null); }}
                  >
                    <CardContent className="flex items-center justify-between gap-3 pt-6">
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(a.type)} · {a._count?.questions ?? 0} questions ·{' '}
                          {a._count?.invitations ?? 0} invited
                          {a.durationMinutes ? ` · ${a.durationMinutes} min` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{t(a.status)}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete assessment"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove.mutate(a.id);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <PaginationControls
                  page={page}
                  totalPages={assessments.data.totalPages}
                  total={assessments.data.total}
                  onPageChange={setPage}
                />
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No assessments"
                description="Create an assessment to evaluate candidates on skills, behavior or technical ability."
              />
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">Details & invitations</h2>
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">
                Select an assessment to see its questions and invitations.
              </p>
            ) : selected.isPending ? (
              <div className="animate-pulse rounded-xl border bg-muted/40 p-6" />
            ) : selected.data ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selected.data.title}</CardTitle>
                  <CardDescription>
                    {selected.data.description ?? t('assessmentCopy29')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {selected.data.questions?.map((q, i) => (
                      <div key={q.id} className="rounded-lg border p-3 text-sm">
                        <p>
                          {i + 1}. {q.prompt}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(q.type)} · {q.points} pts
                        </p>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t('assessmentCopy30')}</p>
                    <Dialog open={inviteFor === selectedId} onOpenChange={(o) => (o ? setInviteFor(selectedId) : setInviteFor(null))}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-1 size-4" /> {t('assessmentCopy31')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('assessmentCopy30')}</DialogTitle>
                          <DialogDescription>
                            {t('assessmentCopy32')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Select value={inviteCandidateId} onValueChange={setInviteCandidateId}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('assessmentCopy33')} />
                            </SelectTrigger>
                            <SelectContent>
                              {applications.data?.items.filter((app, index, all) => (!selected.data?.jobId || app.jobId === selected.data.jobId) && all.findIndex(other => other.candidateId === app.candidateId && (!selected.data?.jobId || other.jobId === selected.data.jobId)) === index).map((app) => (
                                <SelectItem key={app.candidate!.id} value={app.candidate!.id}>
                                  {app.candidate?.user.name} — {app.job?.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <DialogFooter>
                            <Button
                              disabled={!inviteCandidateId || invite.isPending}
                              onClick={() => invite.mutate(selectedId)}
                            >
                              {invite.isPending ? t('assessmentCopy34') : t('assessmentCopy35')}
                            </Button>
                          </DialogFooter>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {reviewId && <AssessmentReview key={reviewId} companyId={companyId} attemptId={reviewId} />}
                  {invitations.data && invitations.data.length > 0 ? (
                    <div className="space-y-2">
                      {invitations.data.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div>
                            <p className="font-medium">{inv.candidate?.user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {inv.candidate?.user.email}
                              {inv.attempt
                                ? ` · ${t(inv.attempt.status)}${inv.attempt.score != null ? ` · ${inv.attempt.score} pts` : ''}`
                                : ` · ${t('PENDING')}`}
                            </p>
                          </div>
                          {inv.attempt?.status === 'COMPLETED' && <Button size="sm" variant="outline" onClick={() => setReviewId(inv.attempt!.id)}>{t('reviewAnswers')}</Button>}
                          {inv.token ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigator.clipboard?.writeText(inv.token!)}
                            >
                              <Copy className="mr-1 size-3.5" /> {t('assessmentCopy36')}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('assessmentCopy37')}</p>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      </div>
    </RequireCompanyPermission>
  );
}
