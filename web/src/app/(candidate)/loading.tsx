'use client';

import { EasyJobLoader } from '@/components/ui/easyjob-loader';

export default function CandidateLoading() {
  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-slate-200/50 dark:bg-slate-800/60 animate-pulse" />
        </div>
        <div className="h-10 w-10 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
      </div>

      {/* Main Content Loading Section */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card dark:bg-slate-900 p-8 shadow-xs flex flex-col items-center justify-center min-h-[320px]">
        <EasyJobLoader />
        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Loading dashboard...</p>
      </div>
    </div>
  );
}
