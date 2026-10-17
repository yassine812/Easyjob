'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { studioApi } from '@/lib/api/cv-studio';
import { Busy, FeatureGate } from '../career-shared';
import { StudioEditor } from './studio-editor';

export function CvStudioRoute({ resumeId, draftId, mode }: { resumeId?: string; draftId?: string; mode?: string }) {
  return <FeatureGate feature="career.builder"><Suspense fallback={<Busy />}><StudioRouteContent resumeId={resumeId} draftId={draftId} mode={mode} /></Suspense></FeatureGate>;
}
function StudioRouteContent({ resumeId, draftId, mode }: { resumeId?: string; draftId?: string; mode?: string }) {
  const params = useSearchParams(), sourceId = resumeId || params.get('resumeId') || undefined;
  const requestedMode = mode || params.get('mode') || 'manual';
  const editingMode = ['ai', 'optimize', 'interview'].includes(requestedMode) ? 'ai' : 'manual';
  const targetJob = params.get('jobId') || undefined;
  const returnTo = params.get('returnTo') || undefined;
  const query = useQuery({ queryKey: ['cv-studio-open', draftId ?? sourceId, targetJob], queryFn: () => draftId ? studioApi.get(draftId) : studioApi.start({ mode: 'import', resumeId: sourceId, jobId: targetJob }), enabled: !!(draftId || sourceId), retry: false, staleTime: Infinity, gcTime: 0 });
  if (!draftId && !sourceId) return <StudioCreate mode={editingMode} />;
  if (query.isPending) return <Busy />;
  if (query.isError) return <div className="mx-auto max-w-xl space-y-4 py-12"><h1 className="text-xl font-semibold">Impossible d’ouvrir ce CV</h1><p role="alert" className="text-sm text-muted-foreground">{query.error.message}</p><div className="flex gap-3"><Button onClick={() => query.refetch()}>Réessayer</Button><Button variant="outline" asChild><Link href="/candidate/cvs">Mes CV</Link></Button></div></div>;
  return <StudioEditor key={query.data.id} initial={query.data} mode={editingMode} returnTo={returnTo} />;
}
function StudioCreate({ mode }: { mode: string }) {
  const router = useRouter(), [title, setTitle] = useState('Mon CV'), [choice, setChoice] = useState(mode);
  const create = useMutation({ mutationFn: () => studioApi.start({ title, mode: choice }), onSuccess: d => router.replace(`/candidate/cvs/drafts/${d.id}?mode=${choice}`) });
  return <div className="mx-auto max-w-2xl py-8"><Link href="/candidate/cvs" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Mes CV</Link><h1 className="mt-8 text-3xl font-semibold">Construisons ton prochain CV.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Un document structuré, un modèle professionnel et des conseils fondés sur tes informations. Ton brouillon sera sauvegardé au fil du travail.</p><div className="mt-7 grid gap-4 sm:grid-cols-2">{['ai', 'manual'].map(v => <button key={v} aria-pressed={choice === v} onClick={() => setChoice(v)} className={`rounded-xl border p-5 text-start ${choice === v ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted'}`}>{v === 'ai' ? <EasyJobFeatureMark size="md" className="mb-4  text-primary" /> : <Pencil className="mb-4 size-5 text-primary" />}<strong className="block text-sm">{v === 'ai' ? 'Avec EasyJob' : 'Manuellement'}</strong><span className="mt-2 block text-xs leading-5 text-muted-foreground">{v === 'ai' ? 'Réponds progressivement aux questions, puis affine les propositions avec le coach.' : 'Renseigne tes informations et compose librement tes rubriques.'}</span></button>)}</div><form className="mt-7 space-y-5" onSubmit={e => { e.preventDefault(); create.mutate(); }}><label className="block space-y-2 text-sm font-medium">Nom du CV<Input value={title} maxLength={150} onChange={e => setTitle(e.target.value)} /></label>{create.isError && <p role="alert" className="text-sm text-destructive">{create.error.message}</p>}<Button disabled={create.isPending || title.trim().length < 2}>{create.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{choice === 'ai' ? 'Commencer avec EasyJob' : 'Ouvrir mon éditeur'}<ArrowRight className="ms-2 size-4" /></Button></form></div>;
}
