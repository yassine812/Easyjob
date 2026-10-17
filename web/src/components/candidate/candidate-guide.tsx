'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth-store';
import { useReleaseText } from '@/lib/i18n/release';

/**
 * A first-login welcome hint. It is intentionally short and self-dismissing:
 * the full tour was too intrusive when it reopened on every sign-in.
 */
export function CandidateGuide() {
  const t = useReleaseText();
  const userId = useAuthStore(state => state.user?.id);
  const [visible, setVisible] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = userId ? `easyjob:welcome:v1:${userId}` : null;

  useEffect(() => {
    if (!key || loadedFor === key) return;
    let seen = false;
    try { seen = localStorage.getItem(key) === 'done'; } catch { /* Continue without browser storage. */ }
    let verificationWelcome = false;
    try { verificationWelcome = sessionStorage.getItem(`easyjob:verification-welcome:${userId}`) === 'pending'; } catch { /* Storage unavailable. */ }
    // Hydrate the account-specific browser storage after SSR; loadedFor bounds this to one update per account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!seen || verificationWelcome);
    setLoadedFor(key);
  }, [key, loadedFor, userId]);

  useEffect(() => {
    if (!visible || !key || loadedFor !== key) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(key, 'done'); } catch { /* Dismiss for this session. */ }
      try { sessionStorage.removeItem(`easyjob:verification-welcome:${userId}`); } catch { /* Storage unavailable. */ }
      setVisible(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [visible, key, loadedFor, userId]);

  if (!visible || !key || loadedFor !== key) return null;
  return <div role="status" aria-live="polite" className="fixed bottom-24 end-4 z-40 flex max-w-[calc(100vw-2rem)] items-end gap-2 lg:bottom-6">
    <Image src="/images/coach/easyjob-human-transparent.png" alt="" width={130} height={160} className="h-36 w-28 shrink-0 object-contain object-bottom" />
    <div className="mb-3 max-w-56 rounded-2xl border border-primary/40 bg-card px-4 py-3 shadow-xl">
      <p className="font-semibold">{t('Bon retour', 'Welcome back', 'مرحباً بعودتك')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('Ravi de te revoir sur EasyJob.', 'Good to see you again on EasyJob.', 'يسعدنا رؤيتك مجدداً على EasyJob.')}</p>
    </div>
  </div>;
}
