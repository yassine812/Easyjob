'use client';
import { useAuthStore } from '@/store/auth-store';
import { useI18n } from '@/lib/i18n';
import { useWorkspace } from '@/hooks/use-workspace';

const demoAccounts = new Set(['admin@startupstarter.test', 'aadmin@startupstarter.test', 'badmin@startupstarter.test', 'cadmin@startupstarter.test', 'cara@example.test', 'bob@example.test', 'dana@example.test', 'eve@example.test', 'hr@acme.example.com', 'recruiter@acme.example.com', 'hm@acme.example.com', 'interviewer@acme.example.com', 'hr@initech.example.com']);
export function DemoNotice() {
  const email = useAuthStore(s => s.user?.email);
  const { locale } = useI18n();
  const { currentWorkspace } = useWorkspace();
  if (!email || !demoAccounts.has(email.toLowerCase())) return null;
  const copy = locale === 'fr'
    ? ['Compte de démonstration', 'Les profils, entreprises et offres d’exemple servent à tester les parcours. Les CV que tu ajoutes restent tes propres documents.']
    : locale === 'ar' ? ['حساب تجريبي', 'الملفات والشركات والوظائف النموذجية مخصصة لتجربة المنصة. السير الذاتية التي ترفعها تبقى مستنداتك الخاصة.']
    : ['Demo account', 'Sample profiles, companies and jobs help you explore the product. CVs you upload remain your own documents.'];
  // Platform Admin reports current database state.  It must not be framed as
  // a demo, even when the local database contains seeded development rows.
  if (currentWorkspace === 'admin') return null;
  return <aside aria-label={copy[0]} className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">{copy[0]}</p><p className="mt-1 text-xs leading-5 opacity-85">{copy[1]}</p></aside>;
}
