'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Building2, Clock, MapPin, Wallet, Wifi } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { jobsApi } from '@/lib/api/jobs';
import { candidatesApi } from '@/lib/api/candidates';
import { applicationsApi } from '@/lib/api/applications';
import { useAuthStore } from '@/store/auth-store';
import { ApplyDialog } from '@/components/candidate/apply-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ErrorState, PageLoader } from '@/components/shared';
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from '@/lib/constants';
import { formatDate, formatSalary } from '@/lib/format';
import { ApiError } from '@/lib/api/client';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isCandidate = !!user && user.roles.includes('CANDIDATE');

  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.detail(jobId),
    enabled: !!jobId,
  });

  const savedQuery = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: () => candidatesApi.savedJobs(),
    enabled: isCandidate,
  });
  const isSaved = savedQuery.data?.some((s) => s.jobId === jobId);

  const appliedQuery = useQuery({
    queryKey: ['my-applications', { page: 1, limit: 50 }],
    queryFn: () => applicationsApi.mine({ page: 1, limit: 50 }),
    enabled: isCandidate,
    select: (d) => d.items,
  });
  const alreadyApplied = appliedQuery.data?.some((a) => a.jobId === jobId);

  const saveMutation = useMutation({
    mutationFn: () =>
      isSaved ? candidatesApi.removeSavedJob(jobId) : candidatesApi.saveJob({ jobId }),
    onSuccess: () => {
      toast.success(isSaved ? 'Removed from saved jobs' : 'Job saved');
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not save job');
    },
  });

  const data = job.data;

  const content = useMemo(() => {
    if (!data) return null;
    return (
      <div>
        <h2 className="text-lg font-semibold">About the role</h2>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{data.description}</p>
        {data.responsibilities.length > 0 ? (
          <>
            <h2 className="mt-6 text-lg font-semibold">Responsibilities</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {data.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        ) : null}
        {data.requirements.length > 0 ? (
          <>
            <h2 className="mt-6 text-lg font-semibold">Requirements</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {data.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }, [data]);

  if (job.isPending) return <PageLoader />;
  if (job.isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <ErrorState
          title="Job not found"
          message="This job may have expired or does not exist. Browse all open jobs instead."
          retry={() => job.refetch()}
        />
        <div className="mt-4 text-center">
          <Button asChild variant="outline">
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
        <Link href="/jobs">← Back to jobs</Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{EMPLOYMENT_TYPE_LABELS[data.employmentType]}</Badge>
            <Badge variant="outline">{EXPERIENCE_LEVEL_LABELS[data.experienceLevel]}</Badge>
            {data.remote ? <Badge variant="outline">Remote friendly</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="size-4" />
              {data.company?.commercialName ?? 'Company'}
            </span>
            {data.location ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {data.location}
              </span>
            ) : null}
            {data.remote ? (
              <span className="flex items-center gap-1.5">
                <Wifi className="size-4" /> Remote
              </span>
            ) : null}
            {data.expiresAt ? (
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> Expires {formatDate(data.expiresAt)}
              </span>
            ) : null}
          </div>

          {data.skills && data.skills.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {data.skills.map((s) => (
                <Badge key={s.skill.id} variant="secondary">
                  {s.skill.name}
                  {s.required ? ' · required' : ''}
                </Badge>
              ))}
            </div>
          ) : null}

          <Separator className="my-6" />
          {content}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Salary</p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <Wallet className="size-4 text-muted-foreground" />
              {formatSalary(data.salaryMin, data.salaryMax, data.currency ?? 'USD')}
            </p>
            <Separator className="my-4" />
            <div className="mt-5 flex flex-col gap-2">
              {isCandidate ? (
                <ApplyDialog
                  jobId={data.id}
                  jobTitle={data.title}
                  alreadyApplied={alreadyApplied}
                />
              ) : (
                <Button asChild size="lg">
                  <Link href="/login">Log in to apply</Link>
                </Button>
              )}
              {isCandidate ? (
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  <Bookmark className={`mr-2 size-4 ${isSaved ? 'fill-current' : ''}`} />
                  {isSaved ? 'Saved' : 'Save job'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/40 p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">About {data.company?.commercialName}</p>
            <p className="mt-1">
              This job is posted by {data.company?.commercialName} on EasyJob.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
