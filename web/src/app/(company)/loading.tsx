'use client';

import { EasyJobLoader } from '@/components/ui/easyjob-loader';
import { SkeletonRows } from '@/components/shared';

export default function CompanyLoading() {
  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-72 rounded-lg bg-slate-200/50 dark:bg-slate-800/60 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>

      {/* Top Stats Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card dark:bg-slate-900 p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
              <div className="size-4 rounded-full bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <div className="h-8 w-16 rounded-lg bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
              <div className="h-4 w-20 rounded bg-slate-200/50 dark:bg-slate-800/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Loading Section with EasyJob Branded Loader */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card dark:bg-slate-900 p-8 shadow-xs flex flex-col items-center justify-center min-h-[320px]">
        <EasyJobLoader />
      </div>
    </div>
  );
}
