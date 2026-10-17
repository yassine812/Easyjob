'use client';

import { useWorkspace } from '@/hooks/use-workspace';
import { usePublicJobsText } from '@/lib/i18n/public-jobs';
import { useI18n } from '@/lib/i18n';
import { CareerJobDetail } from '@/components/candidate/career-job-detail';
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
import { formatDate, formatJobSalary } from '@/lib/format';
import { ApiError } from '@/lib/api/client';
import { publicJobViewMode } from '@/lib/job-display';

export default function JobDetailPage() {
  const workspace = useWorkspace();
  return workspace.currentWorkspace === 'career' ? <CareerJobDetail /> : <PublicNativeJobDetail />;
}
function PublicNativeJobDetail() {
  const workspace = useWorkspace(), t = usePublicJobsText(), { locale } = useI18n();
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isCandidate = workspace.currentWorkspace === 'career';

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
  const isCompanyOwner = !!user && !!data && user.memberships.some((membership) => membership.companyId === data.companyId);
  const viewMode = publicJobViewMode(workspace.currentWorkspace === 'recruiter', isCandidate);

  const content = useMemo(() => {
    if (!data) return null;
    return (
      <div>
        <h2 className="text-lg font-semibold">{t('aboutRole')}</h2>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{data.description}</p>
        {data.responsibilities.length > 0 ? (
          <>
            <h2 className="mt-6 text-lg font-semibold">{t('responsibilities')}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {data.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        ) : null}
        {data.requirements.length > 0 ? (
          <>
            <h2 className="mt-6 text-lg font-semibold">{t('requirements')}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {data.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }, [data, locale]);

  if (job.isPending) return <PageLoader />;
  if (job.isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <ErrorState
          title={t('notFound')}
          message={t('notFoundHelp')}
          retry={() => job.refetch()}
        />
        <div className="mt-4 text-center">
          <Button asChild variant="outline">
            <Link href={workspace.jobs}>{t('backJobs')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
        <Link href={workspace.jobs}>← {t('backJobs')}</Link>
      </Button>

      {viewMode === 'recruiter-preview' && <p className="mb-4 text-sm font-semibold text-primary">{t('preview')}</p>}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t(data.employmentType)}</Badge>
            <Badge variant="outline">{t(data.experienceLevel)}</Badge>
            {data.remote ? <Badge variant="outline">{t('remote')}</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="size-4" />
              {data.company?.commercialName ?? t('company')}
            </span>
            {data.location ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {data.location}
              </span>
            ) : null}
            {data.remote ? (
              <span className="flex items-center gap-1.5">
                <Wifi className="size-4" /> {t('remote')}
              </span>
            ) : null}
            {data.expiresAt ? (
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> {t('expires')} {new Date(data.expiresAt).toLocaleDateString(locale)}
              </span>
            ) : null}
          </div>

          {data.skills && data.skills.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {data.skills.map((s) => (
                <Badge key={s.skill.id} variant="secondary">
                  {s.skill.name}
                  {s.required ? ` · ${t('required')}` : ''}
                </Badge>
              ))}
            </div>
          ) : null}

          <Separator className="my-6" />
          {content}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{t('salary')}</p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <Wallet className="size-4 text-muted-foreground" />
              {formatJobSalary(data.salaryMin, data.salaryMax, data.currency ?? 'TND', locale)}
            </p>
            {viewMode !== 'recruiter-preview' ? (
              <>
                <Separator className="my-4" />
                <div className="mt-5 flex flex-col gap-2">
                  {viewMode === 'candidate' ? (
                    <ApplyDialog
                      jobId={data.id}
                      jobTitle={data.title}
                      alreadyApplied={alreadyApplied}
                    />
                  ) : (
                    <Button asChild size="lg">
                      <Link href="/login">{t('loginApply')}</Link>
                    </Button>
                  )}
                  {viewMode === 'candidate' ? (
                    <Button
                      variant="outline"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      <Bookmark className={`mr-2 size-4 ${isSaved ? 'fill-current' : ''}`} />
                      {t(isSaved ? 'saved' : 'save')}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-xl border bg-muted/40 p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('about')} · {data.company?.commercialName}</p>
            <p className="mt-1">
              {t('postedBy')} {data.company?.commercialName}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
