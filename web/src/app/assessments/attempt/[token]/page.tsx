'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { assessmentsApi } from '@/lib/api/assessments';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';

export default function AssessmentAttemptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);

  const start = useQuery({
    queryKey: ['assessment-attempt', token],
    queryFn: () => assessmentsApi.startAttempt({ token }),
    enabled: !!token,
    retry: false,
  });

  const attempt = start.data;

  const durationSeconds = attempt?.durationMinutes ? attempt.durationMinutes * 60 : null;

  useEffect(() => {
    if (!durationSeconds) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [durationSeconds]);

  const timeLeft = durationSeconds ? Math.max(0, durationSeconds - elapsed) : null;
  const timeLabel = timeLeft !== null
    ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
    : null;

  const submit = useMutation({
    mutationFn: () => {
      const payload = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      };
      return assessmentsApi.submitAttempt(attempt!.id, payload);
    },
    onSuccess: (res) => {
      setResult({ score: res.score, maxScore: res.maxScore });
      toast.success('Assessment submitted');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit'),
  });

  const unanswered = useMemo(() => {
    if (!attempt) return 0;
    return attempt.questions.filter((q) => !answers[q.id]).length;
  }, [attempt, answers]);

  if (start.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (start.isError || !attempt) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="font-medium">Assessment unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {start.error instanceof ApiError
                ? start.error.message
                : 'The invitation token may be invalid, expired or already used.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    const pct = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <h1 className="text-2xl font-semibold">Submitted!</h1>
            <p className="text-muted-foreground">
              Score: <strong>{result.score}</strong> / {result.maxScore} ({pct}%)
            </p>
            <p className="text-sm text-muted-foreground">
              Multiple-choice questions are auto-scored. Text and coding answers are reviewed by the
              company.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assessment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Started {formatDate(attempt.startedAt)}
            {attempt.durationMinutes ? ` · ${attempt.durationMinutes} minutes` : ''}
          </p>
        </div>
        {timeLabel ? (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium">
            <Clock className="size-4 text-muted-foreground" />
            {timeLeft === 0 ? 'Time is up' : timeLabel}
          </div>
        ) : null}
      </div>

      {timeLeft === 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Time is up — please submit your answers.
        </div>
      ) : null}

      <div className="mt-8 space-y-5">
        {attempt.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {q.prompt}
              </CardTitle>
              <CardDescription>
                {q.type.replace('_', ' ')} · {q.points} point{q.points === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {q.type === 'MULTIPLE_CHOICE' && q.options && q.options.length > 0 ? (
                <RadioGroup
                  value={answers[q.id] ?? ''}
                  onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                >
                  {q.options.map((o) => (
                    <div key={o.value} className="flex items-center space-x-2 rounded-lg border p-3">
                      <RadioGroupItem value={o.value} id={`${q.id}-${o.value}`} />
                      <Label htmlFor={`${q.id}-${o.value}`} className="flex-1 cursor-pointer font-normal">
                        {o.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  placeholder={q.type === 'CODING' ? 'Write your solution here…' : 'Your answer…'}
                  className="min-h-28 font-mono"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {unanswered > 0 ? `${unanswered} unanswered question${unanswered === 1 ? '' : 's'}` : 'All answered'}
        </p>
        <Button
          size="lg"
          disabled={submit.isPending}
          onClick={() => {
            if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) {
              return;
            }
            submit.mutate();
          }}
        >
          {submit.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Submitting…
            </>
          ) : (
            'Submit assessment'
          )}
        </Button>
      </div>
    </div>
  );
}
