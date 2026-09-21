'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Delivery = { id: string; companyName: string; email: string; status: string };
export function ProvisionCompany() {
  const t = useReleaseText(), qc = useQueryClient();
  const [open, setOpen] = useState(false), [success, setSuccess] = useState(false);
  const deliveries = useQuery({ queryKey: ['company-deliveries'], queryFn: () => api.get<Delivery[]>('/admin/company-deliveries'), refetchInterval: q => q.state.data?.some(d => ['PENDING', 'SENDING'].includes(d.status)) ? 5000 : false });
  const create = useMutation({ mutationFn: (data: Record<string, string>) => api.post('/admin/companies', data), onSuccess: async () => {
    setOpen(false); setSuccess(true); await qc.invalidateQueries({ queryKey: ['admin-companies'] }); await deliveries.refetch();
  } });
  const retry = useMutation({ mutationFn: (id: string) => api.post(`/admin/company-deliveries/${id}/retry`, {}), onSuccess: () => deliveries.refetch() });
  const labels: Record<string, string> = {
    PENDING: t('En attente d’envoi', 'Queued for delivery', 'بانتظار الإرسال'), SENDING: t('Envoi en cours', 'Sending', 'جارٍ الإرسال'),
    SENT: t('Accepté par le serveur e-mail', 'Accepted by mail server', 'قبله خادم البريد'), FAILED: t('Échec de l’envoi', 'Delivery failed', 'فشل الإرسال'),
    EXPIRED: t('Expiré — récupération du mot de passe nécessaire', 'Expired — password recovery required', 'منتهي الصلاحية — استعادة كلمة المرور مطلوبة'),
    SIMULATED: t('Mode test — aucun e-mail envoyé', 'Test mode — no email delivered', 'وضع الاختبار — لم يُرسل بريد'), CANCELLED: t('Accès déjà personnalisé', 'Password already changed', 'تم تغيير كلمة المرور'),
  };
  return <section className="my-6 space-y-4 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{t('Créer un espace entreprise', 'Create a company workspace', 'إنشاء مساحة شركة')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('Un compte responsable, un mot de passe généré et un e-mail d’accès.', 'An owner account, generated password and access email.', 'حساب مسؤول وكلمة مرور مولّدة وبريد للدخول.')}</p></div><Button onClick={() => { setOpen(!open); setSuccess(false); create.reset(); }}>{open ? t('Fermer', 'Close', 'إغلاق') : t('Nouvelle entreprise', 'New company', 'شركة جديدة')}</Button></div>
    {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{t('Entreprise créée. Le statut d’envoi apparaît ci-dessous.', 'Company created. Delivery status appears below.', 'تم إنشاء الشركة. تظهر حالة الإرسال أدناه.')}</p>}
    {open && <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); create.mutate(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>); }}>
      {[
        ['commercialName', t('Nom commercial', 'Company name', 'الاسم التجاري'), 'text', 120],
        ['legalName', t('Raison sociale', 'Legal name', 'الاسم القانوني'), 'text', 200],
        ['ownerName', t('Nom du responsable RH', 'HR owner name', 'اسم مسؤول الموارد البشرية'), 'text', 120],
        ['ownerEmail', t('E-mail professionnel du responsable', 'Owner work email', 'البريد المهني للمسؤول'), 'email', 254],
      ].map(([name, label, type, max]) => <label key={name} className="space-y-2 text-sm"><span>{label}</span><Input name={String(name)} type={String(type)} required maxLength={Number(max)} /></label>)}
      <p className="text-xs text-muted-foreground sm:col-span-2">{t('Le responsable devra changer son mot de passe à la première connexion, sous 24 heures. L’entreprise sera activée par votre création.', 'The owner must change their password on first sign-in within 24 hours. Creating the company activates it.', 'يجب تغيير كلمة المرور عند أول دخول خلال 24 ساعة. إنشاء الشركة يفعّلها.')}</p>
      {create.isError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{create.error.message}</p>}
      <Button type="submit" disabled={create.isPending}>{create.isPending ? '…' : t('Créer et envoyer les accès', 'Create and send access', 'إنشاء وإرسال بيانات الدخول')}</Button>
    </form>}
    {deliveries.isError && <Button variant="outline" onClick={() => deliveries.refetch()}>{t('Recharger les envois', 'Reload deliveries', 'إعادة تحميل الإرسال')}</Button>}
    {!!deliveries.data?.length && <div className="space-y-3 border-t pt-4">{deliveries.data.slice(0, 10).map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><p className="font-medium">{d.companyName}</p><p className="text-xs text-muted-foreground">{d.email}</p></div><p role="status">{labels[d.status] || d.status}</p>{d.status === 'FAILED' && <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(d.id)}>{t('Réessayer', 'Retry', 'إعادة المحاولة')}</Button>}</div>)}</div>}
    {retry.isError && <p role="alert" className="text-sm text-destructive">{retry.error.message}</p>}
  </section>;
}
