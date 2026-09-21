'use client';

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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Find jobs</h1>
      <p className="mt-1 text-muted-foreground">
        Search open positions from verified companies. Applying is free.
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Job title, skills, or keywords"
            className="pl-9"
            aria-label="Search jobs"
          />
        </div>
        <div className="relative sm:w-64">
          <SlidersHorizontal className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (e.g. Tunis, Remote)"
            className="pl-9"
            aria-label="Location"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Filters */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="ft" className="text-xs text-muted-foreground">
            Employment type
          </Label>
          <Select value={employmentType} onValueChange={(v) => { setEmploymentType(v); setPage(1); }}>
            <SelectTrigger id="ft" className="mt-1">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="el" className="text-xs text-muted-foreground">
            Experience level
          </Label>
          <Select
            value={experienceLevel}
            onValueChange={(v) => { setExperienceLevel(v); setPage(1); }}
          >
            <SelectTrigger id="el" className="mt-1">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {Object.entries(EXPERIENCE_LEVEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sm" className="text-xs text-muted-foreground">
            Min salary (USD/year)
          </Label>
          <Input
            id="sm"
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            className="mt-1"
            placeholder="e.g. 50000"
          />
        </div>
        <div>
          <Label htmlFor="sort" className="text-xs text-muted-foreground">
            Sort by
          </Label>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger id="sort" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
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
            Remote only
          </label>
        </div>
      </div>

      {hasFilters ? (
        <div className="mt-3">
          <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs">
            Clear all filters
          </Button>
        </div>
      ) : null}

      {/* Results */}
      <div className="mt-8">
        {query.isPending ? (
          <SkeletonRows rows={6} cols={3} />
        ) : query.isError ? (
          <ErrorState message="Could not load jobs. Please try again." retry={() => query.refetch()} />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState
            title="No jobs match your search"
            description="Try removing some filters or searching for different keywords."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {query.data?.total ?? 0} job{(query.data?.total ?? 0) === 1 ? '' : 's'} found
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
