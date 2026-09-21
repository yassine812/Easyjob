'use client';

import { useParams } from 'next/navigation';
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
import { ApplicationInsights } from '@/components/candidate/application-tracking';

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const application = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.detail(id),
    enabled: !!id,
  });
  const events = useQuery({
    queryKey: ['application-events', id],
    queryFn: () => applicationsApi.events(id),
    enabled: !!id,
  });
  const interviews = useQuery({
    queryKey: ['application-interviews', id],
    queryFn: () => interviewsApi.listForApplication(id),
    enabled: !!id,
  });

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
    <div className="mx-auto max-w-3xl">
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

      <div className="mt-8 space-y-6">
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
                  <Badge variant="outline">{i.status}</Badge>
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
