'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bell, CreditCard, ScanFace, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api/users';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { clearSessionAtomic } from '@/lib/auth-session';
import { useAuthStore } from '@/store/auth-store';
import { useCareerText } from '@/lib/i18n/career';
import { FaceStatusCard } from '@/components/auth/face-status';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { profileFormDialogClass } from '@/components/candidate/profile-form-dialog';
import { DialogContent } from '@/components/ui/dialog';

type Section = 'overview' | 'personal' | 'security' | 'face' | 'notifications' | 'subscription';

export function AdvancedSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useCareerText();
  const [section, setSection] = useState<Section>('overview');
  useEffect(() => { if (!open) setSection('overview'); }, [open]);
  const rows: Array<{ id: Section; icon: typeof UserRound; title: string; description: string }> = [
    { id: 'personal', icon: UserRound, title: t('personalInfo'), description: t('personalInfoHelp') },
    { id: 'security', icon: ShieldCheck, title: t('security'), description: t('securityHelp') },
    { id: 'face', icon: ScanFace, title: t('faceLogin'), description: t('faceLoginHelp') },
    { id: 'notifications', icon: Bell, title: t('notifications'), description: t('notificationsHelp') },
    { id: 'subscription', icon: CreditCard, title: t('subscription'), description: t('subscriptionHelp') },
  ];
  return <>
    <section id="advanced-settings" className="scroll-mt-24 rounded-xl border bg-card p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold">{t('advancedSettings')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('advancedSettingsHelp')}</p></div><Button variant="outline" onClick={() => onOpenChange(true)}>{t('openAdvancedSettings')}</Button></div>
      <div className="mt-5 divide-y rounded-lg border">{rows.map(({ id, icon: Icon, title, description }) => <button key={id} type="button" onClick={() => { onOpenChange(true); setSection(id); }} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50"><Icon className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="block truncate text-xs text-muted-foreground">{description}</span></span><ArrowRight className="size-4 text-muted-foreground" /></button>)}</div>
    </section>
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={profileFormDialogClass}>
      <DialogHeader className="shrink-0 border-b px-6 py-5"><DialogTitle>{section === 'overview' ? t('advancedSettings') : rows.find(row => row.id === section)?.title}</DialogTitle><DialogDescription>{section === 'overview' ? t('advancedSettingsHelp') : rows.find(row => row.id === section)?.description}</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {section === 'overview' && <div className="grid gap-3 sm:grid-cols-2">{rows.map(({ id, icon: Icon, title, description }) => <button key={id} type="button" onClick={() => setSection(id)} className="rounded-xl border p-4 text-start transition-colors hover:bg-muted/50"><Icon className="mb-3 size-5 text-indigo-500" /><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></button>)}</div>}
        {section === 'personal' && <PersonalInformation />}
        {section === 'security' && <PasswordSettings />}
        {section === 'face' && <FaceStatusCard />}
        {section === 'notifications' && <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t('notificationsCurrentHelp')}</p>}
        {section === 'subscription' && <div className="rounded-lg border p-5"><p className="text-sm text-muted-foreground">{t('subscriptionHelp')}</p><Button asChild className="mt-4"><Link href="/candidate/subscription">{t('viewSubscription')}</Link></Button></div>}
      </div>
      {section !== 'overview' && <DialogFooter className="shrink-0 border-t px-6 py-4"><Button variant="outline" onClick={() => setSection('overview')}>{t('back')}</Button></DialogFooter>}
    </DialogContent></Dialog>
  </>;
}

function PersonalInformation() {
  const t = useCareerText();
  const user = useAuthStore(s => s.user); const setUser = useAuthStore(s => s.setUser);
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? ''); const [phone, setPhone] = useState(user?.phone ?? ''); const [saving, setSaving] = useState(false);
  useEffect(() => { setName(user?.name ?? ''); setPhone(user?.phone ?? ''); }, [user?.name, user?.phone]);
  const save = async () => { setSaving(true); try { const updated = await usersApi.updateMe({ name: name.trim(), phone: phone.trim() || undefined }); setUser({ ...user!, name: updated.name, phone: updated.phone }); await queryClient.invalidateQueries({ queryKey: ['candidate-profile'] }); toast.success(t('saved')); } catch (error) { toast.error(error instanceof ApiError ? error.message : t('error')); } finally { setSaving(false); } };
  return <div className="mx-auto max-w-xl space-y-5"><label className="grid gap-2 text-sm font-medium">{t('fullName')}<Input value={name} onChange={event => setName(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('phone')}<Input value={phone} onChange={event => setPhone(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('email')}<Input value={user?.email ?? ''} readOnly aria-readonly="true" /></label><Button onClick={() => void save()} disabled={saving || name.trim().length < 2}>{saving ? t('saving') : t('save')}</Button></div>;
}

function PasswordSettings() {
  const t = useCareerText();
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [saving, setSaving] = useState(false);
  const save = async () => { if (password !== confirm) { toast.error(t('passwordsDoNotMatch')); return; } setSaving(true); try { await authApi.changePassword(currentPassword, password); toast.success(t('passwordUpdated')); clearSessionAtomic(); } catch (error) { toast.error(error instanceof ApiError ? error.message : t('error')); } finally { setSaving(false); } };
  return <div className="mx-auto max-w-xl space-y-5"><label className="grid gap-2 text-sm font-medium">{t('currentPassword')}<Input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('newPassword')}<Input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('confirmPassword')}<Input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label><Button onClick={() => void save()} disabled={saving || !currentPassword || password.length < 8}>{saving ? t('saving') : t('updatePassword')}</Button></div>;
}
