'use client';
import { CandidateOfferList } from '@/components/candidate/employment-offer';

import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, FileText } from 'lucide-react';
import { applicationsApi } from '@/lib/api/applications';
import { interviewsApi } from '@/lib/api/interviews';
import { ApiError } from '@/lib/api/client';
import { PageHeader, ErrorState, PageLoader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { APPLICATION_STATUS_LABELS, INTERVIEW_TYPE_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { TERMINAL_STATUSES } from '@/lib/constants';
import { useApplicationTracking } from '@/hooks/use-application-tracking';
import { ApplicationInsights } from '@/components/candidate/application-tracking';
import { useCareerText } from '@/lib/i18n/career';

export default function ApplicationDetailPage() {
  useApplicationTracking();
  const t = useCareerText();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const application = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.detail(id),
    enabled: !!id,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const events = useQuery({
    queryKey: ['application-events', id],
    queryFn: () => applicationsApi.events(id),
    enabled: !!id,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const interviews = useQuery({
    queryKey: ['application-interviews', id],
    queryFn: () => interviewsApi.listForApplication(id),
    enabled: !!id,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const messages = useQuery({ queryKey: ['application-messages', id], queryFn: () => applicationsApi.messages(id), enabled: !!id, refetchInterval: 15000, refetchIntervalInBackground: false });
  const [message, setMessage] = useState('');
  const sendMessage = useMutation({ mutationFn: () => applicationsApi.sendMessage(id, message.trim(), crypto.randomUUID()), onSuccess: () => { setMessage(''); void queryClient.invalidateQueries({ queryKey: ['application-messages', id] }); toast.success(t('applicationMessageSent')); }, onError: () => toast.error('Could not send message') });

  const withdraw = useMutation({
    mutationFn: () =>
      applicationsApi.updateStatus(id, { newStatus: 'WITHDRAWN' as never }),
    onSuccess: () => {
      toast.success('Application withdrawn');
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not withdraw'),
  });

  if (application.isPending) return <PageLoader />;
  if (application.isError || !application.data) {
    return <ErrorState title="Application not found" message="It may have been removed." />;
  }

  const data = application.data;
  const isTerminal = TERMINAL_STATUSES.includes(data.status);

  return (
    <div className="w-full min-w-0 space-y-7">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/candidate/applications">← Back to applications</Link>
      </Button>
      <PageHeader
        title={data.job?.title ?? 'Application'}
        description={`${data.job?.company?.commercialName ?? ''} · Applied ${formatDateTime(data.appliedAt)}`}
      >
        <Badge
          variant={
            data.status === 'HIRED'
              ? 'success'
              : data.status === 'REJECTED' || data.status === 'WITHDRAWN'
                ? 'destructive'
                : 'secondary'
          }
        >
          {APPLICATION_STATUS_LABELS[data.status]}
        </Badge>
      </PageHeader>
      <ApplicationInsights data={data} />

      <CandidateApplicationMessages data={messages.data?.items ?? []} value={message} onChange={setMessage} onSubmit={event => { event.preventDefault(); if (message.trim()) sendMessage.mutate(); }} pending={sendMessage.isPending} />

      <div className="space-y-6">
        {data.motivation ? (
          <Card>
            <CardHeader>
              <CardTitle>Your motivation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.motivation}</p>
            </CardContent>
          </Card>
        ) : null}

        {data.resume ? (
          <Card>
            <CardHeader>
              <CardTitle>CV attached</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                {data.resume.filename}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <CandidateOfferList applicationId={id} />
        {interviews.data && interviews.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4" /> Interviews
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {interviews.data.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {INTERVIEW_TYPE_LABELS[i.type]} · {formatDateTime(i.startAt)}
                    </p>
                    <p className="text-muted-foreground">{i.location ?? 'Location TBD'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{i.status}</Badge><Button asChild variant="outline" size="sm"><Link href={`/meetings/${i.id}`}>EasyJob Meeting</Link></Button></div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Application history</CardTitle>
          </CardHeader>
          <CardContent>
            {events.data && events.data.length > 0 ? (
              <ol className="relative space-y-4 border-l pl-6">
                {events.data.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[27px] size-2.5 rounded-full bg-primary" />
                    <p className="text-sm">
                      <span className="font-medium">{e.actor?.name ?? 'System'}</span> moved status
                      to{' '}
                      <Badge variant="secondary" className="mx-0.5">
                        {APPLICATION_STATUS_LABELS[e.newStatus]}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
          </CardContent>
        </Card>

        {!isTerminal ? (
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <AlertTriangle className="mr-2 size-4" /> Withdraw application
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The company will no longer see your application.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => withdraw.mutate()} className="bg-destructive hover:bg-destructive/90">
                    Withdraw
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CandidateApplicationMessages({ data, value, onChange, onSubmit, pending }: { data: { id: string; senderType?: string; body: string; createdAt: string }[]; value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; pending: boolean }) {
  const t = useCareerText();
  return <Card><CardHeader><CardTitle>{t('applicationMessages')}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="max-h-96 space-y-3 overflow-y-auto">{data.length ? data.map(item => <article key={item.id} className={`max-w-[90%] rounded-xl border p-3 ${item.senderType === 'CANDIDATE' ? 'ms-auto bg-primary/10' : 'bg-muted/30'}`}><p className="whitespace-pre-wrap text-sm">{item.body}</p><time className="mt-2 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></article>) : <p className="text-sm text-muted-foreground">{t('applicationMessagesEmpty')}</p>}</div><form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}><textarea className="min-h-11 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" required maxLength={10000} value={value} onChange={event => onChange(event.target.value)} placeholder={t('applicationMessagePlaceholder')} aria-label={t('applicationMessagePlaceholder')} /><Button disabled={pending || !value.trim()}>{t('applicationMessageSend')}</Button></form></CardContent></Card>;
}
