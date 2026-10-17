'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { establishSession } from '@/lib/auth-session';
import { useAuthStore } from '@/store/auth-store';
import { useReleaseText } from '@/lib/i18n/release';
import { getDashboardRoute } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const subscribeToHydration = () => () => {};

export function VerifyEmailContent() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? <VerifyEmailForm /> : <div className="h-64" aria-busy="true" />;
}

function VerifyEmailForm() {
  const tr = useReleaseText();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(() => useAuthStore.getState().lastEmail || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const started = useRef(false);
  const send = useCallback(async () => {
    setSending(true);
    setError('');
    try {
      await authApi.resendVerification(email.trim().toLowerCase());
      useAuthStore.getState().setLastEmail(email.trim().toLowerCase());
      setSent(true);
      setRemaining(120);
      setCode('');
    } catch {
      setError(tr('Impossible d’envoyer le code. Réessaie dans un instant.', 'Could not send the code. Please try again shortly.', 'تعذر إرسال الرمز. حاول مجدداً بعد قليل.'));
    } finally { setSending(false); }
  }, [email, tr]);

  useEffect(() => {
    if (params.get('send') !== '1' || !email || started.current) return;
    started.current = true;
    void send();
  }, [email, params, send]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await authApi.verifyEmail({ email: normalizedEmail, code });
      const user = await establishSession(result.accessToken, normalizedEmail);
      useAuthStore.getState().setLastEmail(normalizedEmail);
      try { sessionStorage.setItem(`easyjob:verification-welcome:${user.id}`, 'pending'); } catch { /* Navigation remains available. */ }
      router.replace(getDashboardRoute(user));
    } catch {
      setError(tr('Code incorrect ou expiré. Vérifie les 6 chiffres ou demande un nouveau code.', 'Incorrect or expired code. Check the 6 digits or request a new code.', 'الرمز غير صحيح أو منتهي الصلاحية. تحقّق من الأرقام أو اطلب رمزاً جديداً.'));
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <MailCheck className="mx-auto size-9 text-primary" />
    <div className="text-center">
      <h1 className="text-2xl font-semibold">{tr('Confirme ton e-mail', 'Confirm your email', 'أكّد بريدك الإلكتروني')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tr('Saisis le code à 6 chiffres reçu par e-mail. Il est valable 10 minutes.', 'Enter the 6-digit code from your email. It is valid for 10 minutes.', 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى بريدك. صالح لمدة 10 دقائق.')}</p>
    </div>
    <form onSubmit={verify} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="verification-email">{tr('Adresse e-mail', 'Email address', 'البريد الإلكتروني')}</Label><Input id="verification-email" type="email" autoComplete="email" required value={email} disabled={busy || sending} onChange={e => { setEmail(e.target.value); setCode(''); setSent(false); }} /></div>
      <div className="space-y-2"><Label htmlFor="verification-code">{tr('Code de vérification', 'Verification code', 'رمز التحقق')}</Label><Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} placeholder="000000" className="text-center text-2xl tracking-[0.5em]" onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {sent && <p role="status" className="text-sm text-muted-foreground">{tr('Code envoyé si cette adresse correspond à un compte à confirmer. Vérifie aussi les spams.', 'Code sent if this address belongs to an account awaiting confirmation. Check spam too.', 'تم إرسال الرمز إذا كان الحساب يحتاج إلى تأكيد. تحقّق أيضاً من البريد غير المرغوب فيه.')}</p>}
      <Button type="submit" className="w-full" disabled={busy || sending || code.length !== 6}>{busy ? tr('Connexion…', 'Signing in…', 'جارٍ تسجيل الدخول…') : tr('Confirmer et accéder au tableau de bord', 'Confirm and open dashboard', 'تأكيد وفتح لوحة التحكم')}</Button>
    </form>
    <Button type="button" variant="ghost" className="w-full" disabled={busy || sending || remaining > 0 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} onClick={() => void send()}>{sending ? tr('Envoi…', 'Sending…', 'جارٍ الإرسال…') : remaining > 0 ? `${tr('Renvoyer dans', 'Resend in', 'إعادة الإرسال خلال')} ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : tr('Recevoir un nouveau code', 'Send a new code', 'إرسال رمز جديد')}</Button>
  </div>;
}
