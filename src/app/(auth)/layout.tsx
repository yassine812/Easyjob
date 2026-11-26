'use client';
import { useProductText } from '@/lib/i18n/product';
import { HumanCoach } from '@/components/ui/human-coach';
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

  return <div className={`auth-shell career-canvas relative flex w-full flex-col text-foreground ${isWideFlow ? 'auth-wide' : ''}`}>
    <header className="auth-controls">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4 rtl:rotate-180" />{t('backHome')}</Link>
      <div className="flex items-center gap-3"><LanguageToggle /><ThemeToggle /></div>
    </header>
    <main className="auth-main"><div className="auth-composition">
      {!isWideFlow && <aside className="auth-brand-panel">
        <Logo size="lg" />
        <h1>{t('hero')}<span>{t('heroAccent')}</span></h1>
        <p>{t('heroBody')}</p>
        <HumanCoach pose={1} />
      </aside>}
      <div className="auth-form-panel">{children}</div>
    </div></main>
    {!isCompactAuth && <footer className="auth-footer"><Link href="/">{t('backHome')}</Link></footer>}
  </div>;
}
