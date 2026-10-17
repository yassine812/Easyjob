'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MailCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { clearSessionAtomic } from '@/lib/auth-session';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordPage() {
  const t = useReleaseText();
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState(false);
  const [resendBusy, setResendBusy] = useState(false), [resendError, setResendError] = useState(false), [resendCount, setResendCount] = useState(0), [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!sent) return;
    const timer = setInterval(() => setCooldownSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [sent]);

  const formatCooldown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const resend = async () => {
    if (resendBusy || cooldownSeconds > 0 || resendCount >= 3) return;
    setResendBusy(true); setResendError(false);
    try { await authApi.forgotPassword(email.trim()); setResendCount(value => value + 1); setCooldownSeconds(120); }
    catch { setResendError(true); }
    finally { setResendBusy(false); }
  };

  return <section className="space-y-5">
    {sent ? <><MailCheck className="size-8 text-primary" /><h1 className="text-2xl font-semibold">{t('Vérifiez votre boîte e-mail', 'Check your inbox', 'تحقّق من بريدك الإلكتروني')}</h1><p role="status" className="text-sm leading-6 text-muted-foreground">{t('Un message contenant le lien de réinitialisation sera envoyé à votre adresse e-mail. Vérifiez votre boîte de réception et les courriers indésirables. Le lien est valable une heure.', 'A message with the reset link will be sent to your email address. Check your inbox and spam folder. The link is valid for one hour.', 'ستصلك رسالة تحتوي على رابط إعادة التعيين إلى بريدك الإلكتروني. تحقّق من صندوق الوارد والبريد غير المرغوب فيه. الرابط صالح لمدة ساعة.')}</p><div className="space-y-2"><Button variant="outline" onClick={resend} disabled={resendBusy || cooldownSeconds > 0 || resendCount >= 3}>{resendBusy ? t('Envoi…', 'Sending…', 'جارٍ الإرسال…') : cooldownSeconds > 0 ? t(`Renvoyer dans ${formatCooldown(cooldownSeconds)}`, `Resend in ${formatCooldown(cooldownSeconds)}`, `إعادة الإرسال خلال ${formatCooldown(cooldownSeconds)}`) : resendCount >= 3 ? t('Limite de renvois atteinte', 'Resend limit reached', 'تم بلوغ حد إعادة الإرسال') : t('Renvoyer le lien', 'Resend link', 'إعادة إرسال الرابط')}</Button><p className="text-xs text-muted-foreground">{t(`Vous pouvez renvoyer le lien jusqu’à 3 fois, avec un délai de 2 minutes entre chaque envoi. (${resendCount}/3)`, `You can resend the link up to 3 times, with a 2-minute wait between sends. (${resendCount}/3)`, `يمكنك إعادة إرسال الرابط حتى 3 مرات، مع انتظار دقيقتين بين كل إرسال. (${resendCount}/3)`)}</p>{resendError && <p role="alert" className="text-sm text-destructive">{t('Le renvoi a échoué. Réessayez dans un instant.', 'Resending failed. Try again shortly.', 'فشلت إعادة الإرسال. حاول مجددًا بعد قليل.')}</p>}</div><Button variant="outline" onClick={() => { setSent(false); setCooldownSeconds(0); setResendCount(0); setResendError(false); }}>{t('Corriger mon adresse e-mail', 'Use a different email', 'استخدام بريد آخر')}</Button></> : <>
      <h1 className="text-2xl font-semibold">{t('Mot de passe oublié ?', 'Forgot your password?', 'نسيت كلمة المرور؟')}</h1>
      <p className="text-sm text-muted-foreground">{t('Entrez l’adresse e-mail de votre compte pour recevoir le lien de récupération.', 'Enter your account email to receive a recovery link.', 'أدخل بريد حسابك لاستلام رابط الاستعادة.')}</p>
      <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(false); try { await authApi.forgotPassword(email.trim()); setResendCount(0); setCooldownSeconds(120); setSent(true); } catch { setError(true); } finally { setBusy(false); } }}>
        <label className="block space-y-2"><span>{t('Adresse e-mail', 'Email', 'البريد الإلكتروني')}</span><Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{t('La demande n’a pas pu être envoyée. Réessayez dans un instant.', 'The request could not be sent. Try again shortly.', 'تعذّر إرسال الطلب. حاول مجددًا بعد قليل.')}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? t('Envoi…', 'Sending…', 'جارٍ الإرسال…') : t('Recevoir le lien', 'Send reset link', 'إرسال رابط الاستعادة')}</Button>
      </form>
    </>}
    <Link href="/login" className="block text-center text-sm underline">{t('Retour à la connexion', 'Back to sign in', 'العودة لتسجيل الدخول')}</Link>
  </section>;
}

function ResetPasswordContent() {
  const t = useReleaseText(), token = useSearchParams().get('token') ?? '';
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false), [showConfirm, setShowConfirm] = useState(false);
  if (done) return <section className="space-y-4"><CheckCircle2 className="size-8 text-emerald-600" /><h1 className="text-2xl font-semibold">{t('Mot de passe enregistré', 'Password updated', 'تم تحديث كلمة المرور')}</h1><p role="status" className="text-sm text-muted-foreground">{t('Vos anciennes sessions ont été déconnectées. Connectez-vous avec votre nouveau mot de passe.', 'Your previous sessions have been signed out. Sign in with your new password.', 'تم إنهاء الجلسات السابقة. سجّل الدخول بكلمة المرور الجديدة.')}</p><Button asChild><Link href="/login">{t('Se connecter', 'Sign in', 'تسجيل الدخول')}</Link></Button></section>;
  return <section className="space-y-5"><h1 className="text-2xl font-semibold">{t('Nouveau mot de passe', 'Set a new password', 'تعيين كلمة مرور جديدة')}</h1>
    {!token ? <p role="alert">{t('Le lien est incomplet. Revenez à la page de récupération pour en demander un nouveau.', 'The link is incomplete. Return to password recovery to request a new one.', 'الرابط غير مكتمل. عد إلى صفحة استعادة كلمة المرور لطلب رابط جديد.')}</p> : <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget), password = String(form.get('password'));
      if (password !== form.get('confirm')) { setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.', 'كلمتا المرور غير متطابقتين.')); return; }
      setBusy(true); setError('');
      try { await authApi.resetPassword({ token, newPassword: password }); clearSessionAtomic(); setDone(true); }
      catch { setError(t('Le lien est invalide, expiré ou déjà utilisé, ou le service est indisponible. Retournez à la récupération du mot de passe et réessayez.', 'The link is invalid, expired or already used, or the service is unavailable. Return to password recovery and retry.', 'الرابط غير صالح أو منتهي الصلاحية أو مستخدم، أو الخدمة غير متاحة. عد إلى استعادة كلمة المرور وأعد المحاولة.')); }
      finally { setBusy(false); }
    }}>
      <label className="block space-y-2"><span>{t('Nouveau mot de passe', 'New password', 'كلمة المرور الجديدة')}</span><span className="relative block"><Input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+" className="pr-11" /><button type="button" className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? t('Masquer le mot de passe', 'Hide password', 'إخفاء كلمة المرور') : t('Afficher le mot de passe', 'Show password', 'إظهار كلمة المرور')}><span className="sr-only">{showPassword ? t('Masquer le mot de passe', 'Hide password', 'إخفاء كلمة المرور') : t('Afficher le mot de passe', 'Show password', 'إظهار كلمة المرور')}</span>{showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}</button></span></label>
      <p className="text-xs text-muted-foreground">{t('8 à 72 caractères, avec majuscule, minuscule et chiffre.', '8–72 characters, including uppercase, lowercase and a digit.', 'من 8 إلى 72 حرفًا، مع حرف كبير وصغير ورقم.')}</p>
      <label className="block space-y-2"><span>{t('Confirmer le mot de passe', 'Confirm password', 'تأكيد كلمة المرور')}</span><span className="relative block"><Input name="confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} className="pr-11" /><button type="button" className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground" onClick={() => setShowConfirm(value => !value)} aria-label={showConfirm ? t('Masquer la confirmation', 'Hide confirmation', 'إخفاء التأكيد') : t('Afficher la confirmation', 'Show confirmation', 'إظهار التأكيد')}><span className="sr-only">{showConfirm ? t('Masquer la confirmation', 'Hide confirmation', 'إخفاء التأكيد') : t('Afficher la confirmation', 'Show confirmation', 'إظهار التأكيد')}</span>{showConfirm ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}</button></span></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? '…' : t('Enregistrer', 'Save password', 'حفظ كلمة المرور')}</Button>
    </form>}
  </section>;
}
export function ResetPasswordPage() { return <Suspense fallback={<p role="status">…</p>}><ResetPasswordContent /></Suspense>; }
