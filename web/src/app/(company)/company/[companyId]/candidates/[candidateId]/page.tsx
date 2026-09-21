'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, MapPin, Sparkles } from 'lucide-react';
import { candidatesApi } from '@/lib/api/candidates';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { PageHeader, ErrorState, PageLoader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SKILL_LEVEL_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

export default function CompanyCandidateProfilePage() {
  const params = useParams<{ companyId: string; candidateId: string }>();
  const { companyId, candidateId } = params;

  const profile = useQuery({
    queryKey: ['company-candidate', companyId, candidateId],
    queryFn: () => candidatesApi.viewAsCompany(candidateId, companyId),
    enabled: !!candidateId && !!companyId,
  });

  if (profile.isPending) return <PageLoader />;
  if (profile.isError || !profile.data) {
    return (
      <ErrorState
        title="Candidate profile unavailable"
        message="This profile is not visible to your company (it may be private, or you need an application link)."
      />
    );
  }
  const p = profile.data;

  return (
    <RequireCompanyPermission companyId={companyId} permission="candidate.view">
      <div className="mx-auto max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
          <Link href={`/company/${companyId}/applications`}>← Back to applications</Link>
        </Button>

        <PageHeader
          title={p.user?.name ?? 'Candidate'}
          description={p.headline ?? 'Candidate profile'}
        >
          {p.visibility === 'PUBLIC' ? (
            <Badge variant="success">
              <Sparkles className="mr-1 size-3" /> Public profile
            </Badge>
          ) : null}
        </PageHeader>

        {p.location ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {p.location}
          </p>
        ) : null}

        <div className="mt-8 space-y-6">
          {p.bio ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.bio}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {p.skills.map((s) => (
                  <Badge key={s.id} variant="secondary">
                    {s.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {SKILL_LEVEL_LABELS[s.level]}
                    </span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {p.experiences.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {p.experiences.map((e) => (
                  <div key={e.id}>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.companyName} · {formatDate(e.startDate)} —{' '}
                      {e.current ? 'Present' : formatDate(e.endDate)}
                    </p>
                    {e.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {p.educations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="size-4" /> Education
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.educations.map((e) => (
                  <div key={e.id}>
                    <p className="font-medium">{e.institution}</p>
                    <p className="text-sm text-muted-foreground">
                      {[e.degree, e.field].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {p.resumes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CVs</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {p.resumes.map((r) => (
                    <li key={r.id}>
                      {r.filename} (v{r.version})
                      {r.isPrimary ? ' · primary' : ''}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </RequireCompanyPermission>
  );
}
