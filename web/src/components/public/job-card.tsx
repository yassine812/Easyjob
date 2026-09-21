'use client';

import Link from 'next/link';
import { Building2, Clock, MapPin, Wifi } from 'lucide-react';
import type { Job } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { formatRelative, formatSalary } from '@/lib/format';
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from '@/lib/constants';

export function JobCard({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold group-hover:text-primary">{job.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-3.5" />
            {job.company?.commercialName ?? 'Company'}
          </p>
        </div>
        <Badge variant="secondary">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {job.location ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {job.location}
          </span>
        ) : null}
        {job.remote ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Wifi className="size-3.5" /> Remote
          </span>
        ) : null}
        <span>{EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{formatSalary(job.salaryMin, job.salaryMax, job.currency ?? 'USD')}</p>
        {job.publishedAt ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> {formatRelative(job.publishedAt)}
          </span>
        ) : null}
      </div>

      {job.skills && job.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 5).map((s) => (
            <Badge key={s.skill.id} variant="outline" className="text-[11px]">
              {s.skill.name}
            </Badge>
          ))}
          {job.skills.length > 5 ? (
            <Badge variant="outline" className="text-[11px]">
              +{job.skills.length - 5}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
