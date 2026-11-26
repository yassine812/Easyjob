'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { clearSessionAtomic } from '@/lib/auth-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function ActivationContent() {
  const token = useSearchParams().get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ email: string; companyName: string | null; planName: string | null } | null>(null);
  useEffect(() => { if (token) void authApi.activationPreview(token).then(setPreview).catch(() => setError('Le lien est invalide ou expiré.')); }, [token]);
  if (done) return <section className="space-y-4 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h1 className="text-2xl font-semibold">Votre espace entreprise est activé</h1><p className="text-sm text-muted-foreground">{preview?.companyName ?? 'Votre entreprise'} · {preview?.email}</p><Button asChild><Link href="/login">Accéder à mon espace entreprise</Link></Button></section>;
  return <section className="space-y-5"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-6" /></div><div><h1 className="text-2xl font-semibold">Bienvenue sur EasyJob</h1><p className="mt-1 text-sm text-muted-foreground">Définissez le mot de passe du responsable de votre espace entreprise.</p></div>{preview && <div className="rounded-xl bg-muted/40 p-4 text-sm"><p className="font-semibold">{preview.companyName ?? 'Espace entreprise'}</p><p className="text-muted-foreground">{preview.email}{preview.planName ? ` · ${preview.planName}` : ''}</p></div>}{!token ? <p role="alert" className="text-sm text-destructive">Ce lien d’activation est incomplet.</p> : <form className="space-y-4" onSubmit={async event => { event.preventDefault(); const values = new FormData(event.currentTarget); const password = String(values.get('password') ?? ''); if (password !== String(values.get('confirm') ?? '')) { setError('Les mots de passe ne correspondent pas.'); return; } setBusy(true); setError(''); try { await authApi.resetPassword({ token, newPassword: password }); clearSessionAtomic(); setDone(true); } catch { setError('Le lien est invalide, expiré ou déjà utilisé. Demandez une nouvelle invitation à l’administrateur.'); } finally { setBusy(false); } }}><label className="block space-y-2"><span>Mot de passe</span><Input name="password" type="password" minLength={8} maxLength={72} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+" required autoComplete="new-password" /></label><p className="text-xs text-muted-foreground">8 à 72 caractères, avec majuscule, minuscule et chiffre.</p><label className="block space-y-2"><span>Confirmer le mot de passe</span><Input name="confirm" type="password" minLength={8} maxLength={72} required autoComplete="new-password" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" type="submit" disabled={busy || !preview}>{busy ? 'Activation…' : 'Activer mon compte'}</Button></form>}</section>;
}

export default function CompanyActivationPage() {
  return <Suspense fallback={<p role="status">Chargement…</p>}><ActivationContent /></Suspense>;
}
