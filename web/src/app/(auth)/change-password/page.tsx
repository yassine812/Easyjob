'use client';
import Link from 'next/link';
import { useState } from 'react';
import { authApi } from '@/lib/api/auth';
import { clearSessionAtomic } from '@/lib/auth-session';
import { useAuthStore } from '@/store/auth-store';
import { useReleaseText } from '@/lib/i18n/release';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ChangePasswordPage() {
  const t = useReleaseText(), user = useAuthStore(s => s.user);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  if (done) return <div className="space-y-4"><h1 className="text-2xl font-semibold">{t('Mot de passe enregistré', 'Password saved', 'تم حفظ كلمة المرور')}</h1><p>{t('Reconnectez-vous avec votre nouveau mot de passe.', 'Sign in with your new password.', 'سجّل الدخول بكلمة المرور الجديدة.')}</p><Button asChild><Link href="/login">{t('Se connecter', 'Sign in', 'تسجيل الدخول')}</Link></Button></div>;
  if (!user) return <div className="space-y-4"><p>{t('Connectez-vous pour choisir votre mot de passe.', 'Sign in to choose your password.', 'سجّل الدخول لاختيار كلمة المرور.')}</p><Link href="/login" className="underline">{t('Se connecter', 'Sign in', 'تسجيل الدخول')}</Link></div>;
  return <div className="space-y-5"><h1 className="text-2xl font-semibold">{t('Choisissez votre mot de passe', 'Choose your password', 'اختر كلمة المرور')}</h1><p className="text-sm text-muted-foreground">{t('Votre accès temporaire doit être remplacé avant d’ouvrir votre espace.', 'Replace your temporary password before opening your workspace.', 'استبدل كلمة المرور المؤقتة قبل فتح مساحة العمل.')}</p>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); const data = new FormData(e.currentTarget), current = String(data.get('current')), password = String(data.get('password'));
      if (password !== data.get('confirm')) { setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.', 'كلمتا المرور غير متطابقتين.')); return; }
      setBusy(true); setError('');
      try { await authApi.changePassword(current, password); clearSessionAtomic(); setDone(true); }
      catch { setError(t('Échec. Vérifiez le mot de passe actuel et utilisez un nouveau mot de passe différent. Si l’accès a expiré, utilisez le lien ci-dessous.', 'Unable to change password. Check your current password and choose a different one. If access expired, use the recovery link below.', 'تعذّر التغيير. تحقّق من كلمة المرور الحالية واختر كلمة مختلفة. إذا انتهت الصلاحية، استخدم رابط الاستعادة.')); }
      finally { setBusy(false); }
    }}>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <label className="block space-y-2"><span>{t('Mot de passe actuel', 'Current password', 'كلمة المرور الحالية')}</span><Input name="current" type="password" autoComplete="current-password" required maxLength={72} /></label>
      <label className="block space-y-2"><span>{t('Nouveau mot de passe', 'New password', 'كلمة المرور الجديدة')}</span><Input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+" /></label>
      <p className="text-xs text-muted-foreground">{t('8 à 72 caractères, avec majuscule, minuscule et chiffre.', '8–72 characters, with uppercase, lowercase and a digit.', 'من 8 إلى 72 حرفًا، مع حرف كبير وصغير ورقم.')}</p>
      <label className="block space-y-2"><span>{t('Confirmer', 'Confirm password', 'تأكيد كلمة المرور')}</span><Input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></label>
      <Button type="submit" disabled={busy}>{busy ? '…' : t('Enregistrer et se reconnecter', 'Save and sign in again', 'حفظ وتسجيل الدخول مجددًا')}</Button>
    </form><Link href="/forgot-password" className="block text-sm underline">{t('Mot de passe oublié ou expiré ?', 'Forgotten or expired password?', 'نسيت كلمة المرور أو انتهت صلاحيتها؟')}</Link></div>;
}
