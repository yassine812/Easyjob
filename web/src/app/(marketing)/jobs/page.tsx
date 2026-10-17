'use client';

import Link from 'next/link';
import { useWorkspace } from '@/hooks/use-workspace';
import { usePublicJobsText } from '@/lib/i18n/public-jobs';
import { useI18n } from '@/lib/i18n';
import { Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { jobsApi } from '@/lib/api/jobs';
import { JobCard } from '@/components/public/job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from '@/lib/constants';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'salaryHigh', label: 'Salary: high to low' },
  { value: 'salaryLow', label: 'Salary: low to high' },
  { value: 'title', label: 'Title A–Z' },
];

function JobSearchPage() {
  const t = usePublicJobsText(), { locale } = useI18n(), workspace = useWorkspace();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [employmentType, setEmploymentType] = useState<string>('all');
  const [experienceLevel, setExperienceLevel] = useState<string>('all');
  const [salaryMin, setSalaryMin] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState(false);

  // Keep the keyword field in sync when the URL changes (e.g. CTA deep links),
  // using React's "adjust state during render" pattern instead of an effect.
  const urlKeyword = searchParams.get('keyword') ?? '';
  const [prevKeyword, setPrevKeyword] = useState(urlKeyword);
  if (urlKeyword !== prevKeyword) {
    setPrevKeyword(urlKeyword);
    setKeyword(urlKeyword);
  }

  const queryKey = useMemo(
    () => [
      'jobs-search',
      {
        keyword,
        location,
        remote,
        employmentType,
        experienceLevel,
        salaryMin,
        sort,
        page,
        applied,
      },
    ],
    [keyword, location, remote, employmentType, experienceLevel, salaryMin, sort, page, applied],
  );

  const query = useQuery({
    queryKey,
    queryFn: () =>
      jobsApi.search({
        keyword: keyword || undefined,
        location: location || undefined,
        remote: remote || undefined,
        employmentType: employmentType !== 'all' ? employmentType : undefined,
        experienceLevel: experienceLevel !== 'all' ? experienceLevel : undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        sort,
        page,
        limit: 20,
      }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setApplied(true);
  };

  const clearFilters = () => {
    setKeyword('');
    setLocation('');
    setRemote(false);
    setEmploymentType('all');
    setExperienceLevel('all');
    setSalaryMin('');
    setSort('newest');
    setPage(1);
    setApplied(true);
  };

  const hasFilters =
    keyword || location || remote || employmentType !== 'all' || experienceLevel !== 'all' || salaryMin;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {workspace.currentWorkspace === 'recruiter' && <div className="mb-6 rounded-xl border bg-muted p-4"><p className="text-sm font-semibold">{t('preview')}</p><Link className="mt-2 inline-block text-sm text-primary underline" href={workspace.jobs}>{t('back')}</Link></div>}
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted-foreground">
        {t('description')}
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 start-3 pointer-events-none size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('keyword')}
            style={{ paddingInlineStart: '2.5rem' }}
            aria-label={t('title')}
          />
        </div>
        <div className="relative sm:w-64">
          <SlidersHorizontal className="absolute top-1/2 start-3 pointer-events-none size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('location')}
            style={{ paddingInlineStart: '2.5rem' }}
            aria-label={t('location')}
          />
        </div>
        <Button type="submit">{t('search')}</Button>
      </form>

      {/* Filters */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="ft" className="text-xs text-muted-foreground">
            {t('employment')}
          </Label>
          <Select value={employmentType} onValueChange={(v) => { setEmploymentType(v); setPage(1); }}>
            <SelectTrigger id="ft" className="mt-1">
              <SelectValue placeholder={t('allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {t(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="el" className="text-xs text-muted-foreground">
            {t('experience')}
          </Label>
          <Select
            value={experienceLevel}
            onValueChange={(v) => { setExperienceLevel(v); setPage(1); }}
          >
            <SelectTrigger id="el" className="mt-1">
              <SelectValue placeholder={t('allLevels')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allLevels')}</SelectItem>
              {Object.entries(EXPERIENCE_LEVEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {t(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sm" className="text-xs text-muted-foreground">
            {t('salaryMin')}
          </Label>
          <Input
            id="sm"
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            className="mt-1"
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="sort" className="text-xs text-muted-foreground">
            {t('sort')}
          </Label>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger id="sort" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {t(s.value === 'title' ? 'titleSort' : s.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={remote}
              onCheckedChange={(v) => {
                setRemote(v === true);
                setPage(1);
              }}
            />
            {t('remoteOnly')}
          </label>
        </div>
      </div>

      {hasFilters ? (
        <div className="mt-3">
          <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs">
            {t('clear')}
          </Button>
        </div>
      ) : null}

      {/* Results */}
      <div className="mt-8">
        {query.isPending ? (
          <SkeletonRows rows={6} cols={3} />
        ) : query.isError ? (
          <ErrorState message={t('error')} retry={() => query.refetch()} />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState
            title={t('empty')}
            description={t('emptyHelp')}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('results')} : {query.data?.total ?? 0}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {query.data?.items.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
            <PaginationControls
              page={page}
              totalPages={query.data?.totalPages ?? 1}
              total={query.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobSearchPage />
    </Suspense>
  );
}
