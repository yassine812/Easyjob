'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { dictionaries, type Dictionary, type Locale } from './dictionaries';

const STORAGE_KEY = 'ss.locale';

interface I18nContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Keep the server and first client render on English, then restore the saved
// browser preference after hydration so language controls stay interactive.

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable (private mode) — locale still applies this session */
  }
}

function detectLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr' || stored === 'ar') return stored;
    const nav = window.navigator.language?.toLowerCase() ?? '';
    if (nav.startsWith('ar')) return 'ar';
    if (nav.startsWith('fr')) return 'fr';
  } catch {
    /* fall through */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Read the saved choice after hydration so the server and first client
  // render stay identical while the toggle remains a normal React update.
  useEffect(() => setLocaleState(detectLocale()), []);

  useEffect(() => {
    const dict = dictionaries[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = dict.dir;
  }, [locale]);

  // Persist only an intentional selection. An initial English hydration render
  // must never overwrite the saved language before the store has hydrated.
  const setLocale = useCallback((next: Locale) => { persistLocale(next); setLocaleState(next); }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: dictionaries[locale].dir, t: dictionaries[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <select
      aria-label="Language / اللغة"
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
    >
      {(Object.keys(dictionaries) as Locale[]).map((l) => (
        <option key={l} value={l}>
          {dictionaries[l].languageName}
        </option>
      ))}
    </select>
  );
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  const options: { code: Locale; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'ar', label: 'AR' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Language selection / اختيار اللغة"
      className={`inline-flex items-center rounded-xl bg-gray-100 dark:bg-slate-800 p-1 text-xs font-semibold select-none border border-gray-200/60 dark:border-slate-700/60 ${className}`}
    >
      {options.map((opt) => {
        const isActive = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setLocale(opt.code)}
            className={`flex items-center justify-center rounded-lg px-2.5 py-1 transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-[#3F5FDE] text-white shadow-sm font-bold scale-[1.02]'
                : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
