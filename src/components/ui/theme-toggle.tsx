'use client';
import { useTheme } from 'next-themes';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState } from 'react';
const copy = {
  en: ['Dark mode', 'Switch to light mode', 'Switch to dark mode'],
  fr: ['Mode sombre', 'Passer au mode clair', 'Passer au mode sombre'],
  ar: ['الوضع الداكن', 'التبديل إلى الوضع الفاتح', 'التبديل إلى الوضع الداكن'],
};
export function ThemeToggle({ size = 'default' }: { size?: 'default' | 'sm' | 'lg' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const labels = copy[locale];
  useEffect(() => setMounted(true), []);
  // Keep the server and first client render identical. The button remains
  // present, then reflects the persisted theme as soon as next-themes mounts.
  const isDark = mounted && resolvedTheme === 'dark';
  const travel = size === 'sm' ? 'translate-x-[30px]' : size === 'lg' ? 'translate-x-[46px]' : 'translate-x-[38px]';
  return (
    <button
      type="button"
      role="switch"
      aria-label={labels[0]}
      aria-checked={isDark}
      title={labels[isDark ? 1 : 2]}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative h-11 shrink-0 cursor-pointer rounded-full border border-indigo-200/70 bg-indigo-50/90 shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 ${size === 'sm' ? 'w-[72px]' : size === 'lg' ? 'w-[88px]' : 'w-20'}`}
    >
      <span aria-hidden="true" className={`absolute left-1 top-1 size-[34px] rounded-full bg-white shadow-sm transition-transform duration-300 motion-reduce:transition-none dark:bg-indigo-500 ${isDark ? travel : 'translate-x-0'}`} />
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`pointer-events-none absolute left-3 top-3 size-[18px] transition-colors ${isDark ? 'text-slate-400' : 'text-amber-600'}`}>
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </svg>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`pointer-events-none absolute right-3 top-3 size-[18px] transition-colors ${isDark ? 'text-white' : 'text-indigo-400'}`}>
        <path d="M20.8 13.1A9 9 0 0 1 10.9 3.2a9 9 0 1 0 9.9 9.9Z" />
      </svg>
    </button>
  );
}
