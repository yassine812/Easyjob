'use client';

import { EasyJobLoader } from '@/components/ui/easyjob-loader';

export default function AdminLoading() {
  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
        <div className="h-10 w-28 rounded-xl bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
      </div>

      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card dark:bg-slate-900 p-8 shadow-xs flex flex-col items-center justify-center min-h-[320px]">
        <EasyJobLoader />
        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Loading admin workspace...</p>
      </div>
    </div>
  );
}
