'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MailCheck, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { clearSessionAtomic } from '@/lib/auth-session';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordPage() {
  const t = useReleaseText();
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState(false);
  return <section className="space-y-5">
    {sent ? <><MailCheck className="size-8 text-primary" /><h1 className="text-2xl font-semibold">{t('Vérifiez votre boîte e-mail', 'Check your inbox', 'تحقّق من بريدك الإلكتروني')}</h1><p role="status" className="text-sm leading-6 text-muted-foreground">{t('Si ce compte existe, vous recevrez un lien de réinitialisation valable une heure. Pensez à vérifier les courriers indésirables.', 'If this account exists, you will receive a reset link valid for one hour. Check your spam folder too.', 'إذا كان الحساب موجودًا، فستصلك رسالة برابط لإعادة التعيين صالح لساعة. تحقّق أيضًا من البريد غير المرغوب فيه.')}</p><Button variant="outline" onClick={() => setSent(false)}>{t('Corriger mon adresse e-mail', 'Use a different email', 'استخدام بريد آخر')}</Button></> : <>
      <h1 className="text-2xl font-semibold">{t('Mot de passe oublié ?', 'Forgot your password?', 'نسيت كلمة المرور؟')}</h1>
      <p className="text-sm text-muted-foreground">{t('Entrez l’adresse e-mail de votre compte pour recevoir le lien de récupération.', 'Enter your account email to receive a recovery link.', 'أدخل بريد حسابك لاستلام رابط الاستعادة.')}</p>
      <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(false); try { await authApi.forgotPassword(email.trim()); setSent(true); } catch { setError(true); } finally { setBusy(false); } }}>
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
  if (done) return <section className="space-y-4"><CheckCircle2 className="size-8 text-emerald-600" /><h1 className="text-2xl font-semibold">{t('Mot de passe enregistré', 'Password updated', 'تم تحديث كلمة المرور')}</h1><p role="status" className="text-sm text-muted-foreground">{t('Vos anciennes sessions ont été déconnectées. Connectez-vous avec votre nouveau mot de passe.', 'Your previous sessions have been signed out. Sign in with your new password.', 'تم إنهاء الجلسات السابقة. سجّل الدخول بكلمة المرور الجديدة.')}</p><Button asChild><Link href="/login">{t('Se connecter', 'Sign in', 'تسجيل الدخول')}</Link></Button></section>;
  return <section className="space-y-5"><h1 className="text-2xl font-semibold">{t('Nouveau mot de passe', 'Set a new password', 'تعيين كلمة مرور جديدة')}</h1>
    {!token ? <p role="alert">{t('Le lien est incomplet. Demandez un nouveau lien ci-dessous.', 'The link is incomplete. Request a new one below.', 'الرابط غير مكتمل. اطلب رابطًا جديدًا أدناه.')}</p> : <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget), password = String(form.get('password'));
      if (password !== form.get('confirm')) { setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.', 'كلمتا المرور غير متطابقتين.')); return; }
      setBusy(true); setError('');
      try { await authApi.resetPassword({ token, newPassword: password }); clearSessionAtomic(); setDone(true); }
      catch { setError(t('Le lien est invalide, expiré ou déjà utilisé, ou le service est indisponible. Demandez un nouveau lien ou réessayez.', 'The link is invalid, expired or already used, or the service is unavailable. Request a new link or retry.', 'الرابط غير صالح أو منتهي الصلاحية أو مستخدم، أو الخدمة غير متاحة. اطلب رابطًا جديدًا أو أعد المحاولة.')); }
      finally { setBusy(false); }
    }}>
      <label className="block space-y-2"><span>{t('Nouveau mot de passe', 'New password', 'كلمة المرور الجديدة')}</span><Input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+" /></label>
      <p className="text-xs text-muted-foreground">{t('8 à 72 caractères, avec majuscule, minuscule et chiffre.', '8–72 characters, including uppercase, lowercase and a digit.', 'من 8 إلى 72 حرفًا، مع حرف كبير وصغير ورقم.')}</p>
      <label className="block space-y-2"><span>{t('Confirmer le mot de passe', 'Confirm password', 'تأكيد كلمة المرور')}</span><Input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? '…' : t('Enregistrer', 'Save password', 'حفظ كلمة المرور')}</Button>
    </form>}
    <Link href="/forgot-password" className="block text-sm underline">{t('Demander un nouveau lien', 'Request a new link', 'طلب رابط جديد')}</Link>
  </section>;
}
export function ResetPasswordPage() { return <Suspense fallback={<p role="status">…</p>}><ResetPasswordContent /></Suspense>; }
