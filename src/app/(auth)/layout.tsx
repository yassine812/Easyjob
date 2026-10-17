'use client';
import { useProductText } from '@/lib/i18n/product';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { LanguageToggle } from '@/lib/i18n';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useProductText();
  const pathname = usePathname();
  // Keep the server HTML and the first client render identical. The role
  // picker expands after hydration; login and registration always share the
  // same stable split layout.
  const [hydrated, setHydrated] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    const syncOnboarding = () => setOnboardingActive(document.body.dataset.authOnboarding === 'true');
    syncOnboarding();
    window.addEventListener('easyjob:onboarding-toggle', syncOnboarding);
    return () => window.removeEventListener('easyjob:onboarding-toggle', syncOnboarding);
  }, []);
  const isRoleSelect = hydrated && pathname === '/role-select';
  const isOnboarding = hydrated && onboardingActive;
  const isWideFlow = isRoleSelect || isOnboarding;
  const isCompactAuth = pathname === '/register' || pathname === '/login';
  const isSimpleAuth = isCompactAuth && !isOnboarding;
  return (
    <div className={`career-canvas relative w-full bg-transparent text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-x-hidden ${isSimpleAuth ? 'h-[100dvh] min-h-0 overflow-y-hidden' : 'min-h-screen'}`}>
      {/* Top Floating Controls */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 lg:px-10">
        {isCompactAuth ? <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-[#3F5FDE] dark:text-slate-400"><ArrowLeft className="size-4" />{t('backHome')}</Link> : <div className="md:hidden"><Logo size="lg" /></div>}
        <div className="ms-auto flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main layout: onboarding needs room for structured CV review fields. */}
      <main className={`flex-1 min-h-0 flex items-center justify-center px-4 ${isSimpleAuth ? 'pb-2 pt-16' : isCompactAuth ? 'pb-1 pt-14' : 'pb-8 pt-20'} sm:px-6 lg:px-8 mx-auto w-full ${isWideFlow ? 'max-w-6xl' : isSimpleAuth ? 'max-w-[88rem]' : 'max-w-7xl'}`}>
        <div className={`grid w-full ${isWideFlow ? 'items-center' : 'items-start'} ${isWideFlow ? '' : 'lg:grid-cols-12 gap-12 lg:gap-16'}`}>
          {/* Left Column - Hero Branding */}
          {!isWideFlow && <div className="hidden lg:flex lg:col-span-6 flex-col justify-start space-y-8 pe-4 pt-16">
            <Logo size="lg" />

            <div className="space-y-4">
              <h1 className="font-sans text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-gray-900 dark:text-white leading-[1.12]">
                {t('hero')}
                <br />
                <span className="text-[#3F5FDE] dark:text-[#5B73E8]">{t('heroAccent')}</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 dark:text-slate-300 max-w-md leading-relaxed">
                {t('heroBody')}
              </p>
            </div>

          </div>}

          {/* Right Column - Auth Card */}
          <div className={`${isWideFlow ? 'w-full' : 'lg:col-span-6 flex justify-center lg:justify-end w-full'} ${isSimpleAuth ? '-translate-x-3 -translate-y-8 sm:-translate-y-8 lg:-translate-x-16 lg:-translate-y-4' : ''}`}>
            <div className={`w-full ${isWideFlow ? 'max-w-6xl mx-auto' : 'max-w-md'} bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/90 shadow-2xl shadow-indigo-950/5 rounded-3xl ${isWideFlow ? 'p-6 sm:p-8 lg:p-10' : 'p-3 sm:p-5 lg:p-4'}`}>
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      {!isCompactAuth && <footer className="py-3 text-center text-xs text-gray-500 dark:text-slate-500">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors font-medium">
          {t('backHome')}
        </Link>
      </footer>}
    </div>
  );
}
