'use client';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';
export function ProfilePhoto({ onValidityChange }: { onValidityChange?: (valid: boolean) => void }) {
  const t = useReleaseText(), [error, setError] = useState(''), [previewUrl, setPreviewUrl] = useState<string | null>(null), [imageLoaded, setImageLoaded] = useState(false);
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const imageUrl = user?.avatarUrl ?? null;
  useEffect(() => { setImageLoaded(false); if (!imageUrl) setError(''); }, [imageUrl]);
  const ready = Boolean(previewUrl || (imageUrl && imageLoaded));
  useEffect(() => onValidityChange?.(ready), [onValidityChange, ready]);
  const refreshCurrentUser = async () => { if (user) setUser(await authApi.me()); };
  const save = useMutation({ mutationFn: async (file: File) => { const body = new FormData(); body.append('file', file); return api.post<{ avatar_url: string }>('/candidates/me/photo', body); }, onSuccess: async () => { await refreshCurrentUser(); setError(''); setPreviewUrl(null); }, onError: () => setError(t('Impossible d’enregistrer la photo. Réessaie.', 'Unable to save the photo. Try again.', 'تعذّر حفظ الصورة. حاول مجددًا.')) });
  const remove = useMutation({ mutationFn: async () => { await api.delete('/candidates/me/photo'); }, onSuccess: async () => { await refreshCurrentUser(); setPreviewUrl(null); }, onError: () => setError(t('Suppression impossible. Réessayez.', 'Unable to remove photo. Try again.', 'تعذّر حذف الصورة. حاول مجددًا.')) });
  return <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">{t('Votre photo', 'Your photo', 'صورتك')}</h2><p className="text-sm text-muted-foreground">{t('Ajoute une photo professionnelle qui apparaîtra sur ton profil.', 'Add a professional photo that will appear on your profile.', 'أضف صورة مهنية ستظهر في ملفك الشخصي.')}</p>
    {(previewUrl || imageUrl) && <img key={previewUrl || imageUrl} src={previewUrl || imageUrl || ''} alt={t('Votre photo de profil', 'Your profile photo', 'صورة ملفك الشخصي')} onLoad={() => { setImageLoaded(true); setError(''); }} onError={() => { setImageLoaded(false); setError(t('Impossible de charger la photo enregistrée. Réessaie.', 'The saved photo could not be loaded. Try again.', 'تعذر تحميل الصورة المحفوظة. حاول مجددًا.')); }} className="size-32 rounded-full border-2 border-primary/30 object-cover" referrerPolicy="no-referrer" />}
    <Input type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('Ajouter une photo', 'Upload photo', 'إضافة صورة')} disabled={save.isPending || remove.isPending} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; setError(''); if (!file) return; if (file.size > 5 * 1024 * 1024) { setError(t('Maximum 5 Mo.', 'Maximum 5 MB.', 'الحد الأقصى 5 ميغابايت.')); return; } setPreviewUrl(URL.createObjectURL(file)); save.mutate(file); }} />
    {save.isPending && <p role="status">{t('Enregistrement…', 'Saving…', 'جارٍ الحفظ…')}</p>}
    {ready && <p role="status" className="text-sm font-medium text-emerald-600">{t('Photo de profil enregistrée.', 'Profile photo saved.', 'تم حفظ صورة الملف الشخصي.')}</p>}
    {(previewUrl || imageUrl) && <Button variant="outline" disabled={remove.isPending || save.isPending} onClick={() => { setPreviewUrl(null); remove.mutate(); }}>{t('Supprimer la photo', 'Remove photo', 'حذف الصورة')}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
