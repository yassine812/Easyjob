'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';
import { biometricApi } from '@/lib/api/biometric';
import { env } from '@/config/env';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function ProfilePhoto({ onValidityChange }: { onValidityChange?: (valid: boolean) => void }) {
  const t = useReleaseText(), [error, setError] = useState(''), [previewUrl, setPreviewUrl] = useState<string | null>(null), [faceReady, setFaceReady] = useState(false), [imageLoaded, setImageLoaded] = useState(false), [reloadVersion, setReloadVersion] = useState(0);
  const analysedSavedPhoto = useRef(false);
  const imageRetryCount = useRef(0);
  const photo = useQuery({ queryKey: ['candidate-photo'], queryFn: () => api.get<{ url: string | null }>('/candidates/me/photo'), staleTime: 0, gcTime: 0 });
  const biometric = useQuery({ queryKey: ['biometric', 'status'], queryFn: () => biometricApi.status(), staleTime: 0 });
  const imageUrl = photo.data?.url ? (photo.data.url.startsWith('http') ? photo.data.url : new URL(photo.data.url, env.apiUrl).toString()) : null;
  useEffect(() => { setImageLoaded(false); if (!imageUrl) setError(''); }, [imageUrl]);
  const ready = Boolean((previewUrl || (imageUrl && imageLoaded)) && (faceReady || biometric.data?.enrolled === true));
  useEffect(() => onValidityChange?.(ready), [onValidityChange, ready]);
  const save = useMutation({ mutationFn: async (file: File) => { const body = new FormData(); body.append('file', file); await api.post('/candidates/me/photo', body); await biometricApi.enrollFromPhoto(file); }, onSuccess: () => { setFaceReady(true); setError(''); void biometric.refetch(); }, onError: (err) => { setFaceReady(false); const unavailable = err instanceof ApiError && err.status >= 500; setError(unavailable ? t('La photo est enregistrée, mais le service Face ID est temporairement indisponible. Réessaie dans un instant.', 'The photo is saved, but Face ID is temporarily unavailable. Try again in a moment.', 'تم حفظ الصورة، لكن خدمة تسجيل الدخول بالوجه غير متاحة مؤقتًا. حاول بعد قليل.') : t('Aucun visage exploitable n’a été détecté. Choisis une photo nette avec une seule personne.', 'No usable face was detected. Choose a clear photo with only one person.', 'لم يتم اكتشاف وجه صالح. اختر صورة واضحة لشخص واحد.')); }, onSettled: async () => { await photo.refetch(); setPreviewUrl(null); } });
  const remove = useMutation({ mutationFn: async () => { await api.delete('/candidates/me/photo'); await biometricApi.disable(); }, onSuccess: () => { setFaceReady(false); setPreviewUrl(null); void photo.refetch(); void biometric.refetch(); }, onError: () => setError(t('Suppression impossible. Réessayez.', 'Unable to remove photo. Try again.', 'تعذّر حذف الصورة. حاول مجددًا.')) });
  const analyseSaved = useMutation({ mutationFn: async (url: string) => { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error('profile_photo_unavailable'); await biometricApi.enrollFromPhoto(await response.blob()); }, onSuccess: () => { setFaceReady(true); setError(''); void biometric.refetch(); }, onError: () => setError(t('La photo est enregistrée, mais son analyse a échoué. Choisis-la de nouveau.', 'The photo is saved, but its analysis failed. Select it again.', 'تم حفظ الصورة لكن فشل تحليلها. اخترها مرة أخرى.')) });
  useEffect(() => {
    if (!imageUrl || !imageLoaded || biometric.isPending || biometric.data?.enrolled || ready || analysedSavedPhoto.current) return;
    analysedSavedPhoto.current = true;
    analyseSaved.mutate(imageUrl);
  }, [analyseSaved, biometric.isPending, biometric.data?.enrolled, imageLoaded, imageUrl, ready]);
  return <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">{t('Votre photo', 'Your photo', 'صورتك')}</h2><p className="text-sm text-muted-foreground">{t('Ajoute une photo nette de face. Elle sera utilisée comme photo de profil et comme référence chiffrée pour la connexion par visage.', 'Add a clear front-facing photo. It will be used as your profile photo and as the encrypted reference for face login.', 'أضف صورة أمامية واضحة. ستُستخدم كصورة ملف شخصي ومرجع مشفّر لتسجيل الدخول بالوجه.')}</p>
    {/* CORS mode allows the API's same-origin resource policy to honor its configured frontend origin. */}
    {(previewUrl || imageUrl) && <img crossOrigin="anonymous" key={`${previewUrl || imageUrl}:${reloadVersion}`} src={previewUrl || imageUrl || ''} alt={t('Votre photo de profil', 'Your profile photo', 'صورة ملفك الشخصي')} onLoad={() => { setImageLoaded(true); setError(''); }} onError={() => { setImageLoaded(false); if (imageUrl && imageRetryCount.current < 2) { imageRetryCount.current += 1; setReloadVersion(version => version + 1); void photo.refetch(); return; } setError(t('Impossible de charger la photo enregistrée. Réessaie.', 'The saved photo could not be loaded. Try again.', 'تعذر تحميل الصورة المحفوظة. حاول مجددًا.')); }} className="size-32 rounded-full border-2 border-primary/30 object-cover" referrerPolicy="no-referrer" />}
    <Input type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('Ajouter une photo', 'Upload photo', 'إضافة صورة')} disabled={save.isPending || remove.isPending} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; setError(''); if (!file) return; if (file.size > 5 * 1024 * 1024) { setError(t('Maximum 5 Mo.', 'Maximum 5 MB.', 'الحد الأقصى 5 ميغابايت.')); return; } setPreviewUrl(URL.createObjectURL(file)); save.mutate(file); }} />
    {(save.isPending || analyseSaved.isPending) && <p role="status">{t('Analyse et enregistrement…', 'Analysing and saving…', 'جارٍ التحليل والحفظ…')}</p>}
    {ready && <p role="status" className="text-sm font-medium text-emerald-600">{t('Photo analysée. La connexion par visage est prête.', 'Photo analysed. Face login is ready.', 'تم تحليل الصورة وأصبح تسجيل الدخول بالوجه جاهزًا.')}</p>}
    {(previewUrl || imageUrl) && <Button variant="outline" disabled={remove.isPending || save.isPending} onClick={() => { setPreviewUrl(null); remove.mutate(); }}>{t('Supprimer la photo', 'Remove photo', 'حذف الصورة')}</Button>}
    {(error || photo.isError) && <p role="alert" className="text-sm text-destructive">{error || t('Impossible de charger la photo.', 'Unable to load photo.', 'تعذّر تحميل الصورة.')}</p>}
  </section>;
}
