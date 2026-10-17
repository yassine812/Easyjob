'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Upload, Pencil, Star, Loader2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { resumesApi } from '@/lib/api/resumes';
import { ApiError } from '@/lib/api/client';
import { AtsScoreRing, CvActionsMenu } from './cv-management-actions';
import { Busy, CareerFrame, Failure, PremiumAiAction } from './career-shared';

export function CvLibrary() {
  const picker = useRef<HTMLInputElement>(null), qc = useQueryClient();
  const [error, setError] = useState(''), [recentId, setRecentId] = useState('');
  const cvs = useQuery({ queryKey: ['resumes'], queryFn: resumesApi.list, refetchInterval: q => q.state.data?.some(r => ['PENDING', 'PROCESSING'].includes(r.processingStatus)) ? 2500 : false });
  const policy = useQuery({ queryKey: ['resume-upload-policy'], queryFn: resumesApi.uploadPolicy, staleTime: Infinity });
  const upload = useMutation({ mutationFn: (file: File) => resumesApi.upload(file), onMutate: () => { setError(''); setRecentId(''); }, onSuccess: async r => { setRecentId(r.id); await Promise.all(['resumes', 'career-overview', 'candidate-profile'].map(key => qc.invalidateQueries({ queryKey: [key] }))); }, onError: e => setError(e instanceof ApiError && e.status === 413 ? 'Le fichier dépasse la taille maximale autorisée.' : e instanceof ApiError && e.status === 400 ? 'Ce fichier ne peut pas être importé. Choisis un PDF valide avec du texte sélectionnable.' : e instanceof ApiError && e.status === 403 ? 'La limite de CV de ton abonnement est atteinte.' : 'Impossible d’ajouter ce CV. Vérifie ta connexion et réessaie.') });
  function selectFile(file?: File) {
    if (!file || upload.isPending) return;
    setError(''); upload.reset(); setRecentId('');
    if (!/\.pdf$/i.test(file.name) || !['', 'application/pdf', 'application/octet-stream'].includes(file.type) || !file.size) { setError('Choisis un PDF valide et non vide.'); return; }
    if (policy.data && file.size > policy.data.maxBytes) { setError(`Le fichier dépasse la limite de ${policy.data.maxBytes / 1024 / 1024} Mo.`); return; }
    upload.mutate(file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified }));
  }
  const recent = cvs.data?.find(r => r.id === recentId), working = recent && ['PENDING', 'PROCESSING'].includes(recent.processingStatus);
  const createHref = (mode: string) => `/candidate/cvs/create?mode=${mode}`;
  const add = <DropdownMenu><DropdownMenuTrigger asChild><Button disabled={upload.isPending}><Plus className="me-2 size-4" />Ajouter un CV<ChevronDown className="ms-3 size-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuItem onSelect={() => picker.current?.click()}><Upload className="size-4" />Importer un CV</DropdownMenuItem><DropdownMenuItem asChild><Link href={createHref('ai')}><EasyJobFeatureMark size="sm" className="" />Créer avec EasyJob</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={createHref('manual')}><Pencil className="size-4" />Créer manuellement</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
  return <CareerFrame wide title="Mes CV" showFindJob={false} description="Tes documents, tes versions, ton prochain poste." actions={add}>
    <input ref={picker} type="file" accept="application/pdf,.pdf" hidden aria-label="Choisir un CV PDF" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; selectFile(file); }} />
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm"><p>{error}</p>{upload.isError && upload.variables && !(upload.error instanceof ApiError && [400, 403, 413].includes(upload.error.status)) && <Button variant="outline" onClick={() => upload.mutate(upload.variables!)}>Réessayer</Button>}</div>}
    {(upload.isPending || recent) && <div role="status" className="flex items-center gap-3 border-b pb-4 text-sm">{upload.isPending || working ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-primary" /> : <Check className="size-4 text-primary" />}<div><p className="font-medium">{upload.isPending ? 'Téléversement du CV…' : working ? 'Extraction et analyse de ton CV…' : recent?.processingStatus === 'FAILED' ? 'Analyse impossible : vérifie que le PDF n’est pas chiffré et contient du texte.' : 'CV ajouté'}</p><p className="mt-1 break-all text-xs text-muted-foreground">{upload.isPending ? upload.variables?.name : recent?.filename}</p></div>{upload.isPending && <progress aria-label="Téléversement du CV" className="ms-auto h-1 w-24 accent-primary" />}</div>}
    {cvs.isPending ? <Busy /> : cvs.isError ? <Failure retry={() => cvs.refetch()} /> : !cvs.data.length ? <section className="mx-auto max-w-xl py-12 text-center"><FileText className="mx-auto mb-5 size-10 text-primary" /><h2 className="text-2xl font-semibold">Crée ton premier CV</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Importe un CV existant ou laisse EasyJob t’accompagner étape par étape pour construire un CV professionnel.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild><Link href={createHref('ai')}>Créer avec EasyJob</Link></Button><Button variant="outline" disabled={upload.isPending} onClick={() => picker.current?.click()}>Importer un CV</Button></div><Link className="mt-5 inline-block text-sm text-muted-foreground underline underline-offset-4" href={createHref('manual')}>Créer manuellement</Link></section> : <ul aria-label="Mes CV" className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cvs.data.map(cv => { const analysisPending = ['PENDING', 'PROCESSING'].includes(cv.analysisSummary?.status || cv.processingStatus); return <li key={cv.id} className="group relative flex min-w-0 flex-col rounded-xl border bg-card px-5 py-4 transition-colors hover:border-primary/40">
        <div className="flex items-start gap-3"><FileText aria-hidden className="mt-1 size-6 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><Link href={`/candidate/cvs/${cv.id}`} className="block break-words text-sm font-semibold leading-5 outline-offset-4 [overflow-wrap:anywhere] hover:text-primary" aria-label={`Voir le CV : ${cv.filename}`}>{cv.filename}</Link>{cv.isPrimary && <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary"><Star className="size-3" />CV principal</p>}</div><div className="-me-2 -mt-2"><CvActionsMenu resume={cv} /></div></div>
        <div className="my-4 flex items-center gap-3"><AtsScoreRing score={cv.analysisSummary?.score} pending={analysisPending} /><div><p className="text-xs font-medium">Analyse ATS</p><p className="mt-1 text-[11px] text-muted-foreground">{cv.analysisSummary?.status === 'FAILED' || (!cv.workingDraftId && cv.processingStatus === 'FAILED') ? 'Document à vérifier' : analysisPending ? 'Analyse ATS en cours' : cv.analysisSummary?.score == null ? 'Analyse disponible dans les détails' : cv.analysisSummary?.source === 'draft' ? 'Score du brouillon actuel' : 'Consulte les points à renforcer'}</p></div></div>
        <div className="mb-3 flex items-center gap-1 text-[10px]" aria-label="Langue du CV"><span className="text-muted-foreground">Langue</span><span className="text-muted-foreground">·</span>{cv.variants?.length ? cv.variants.map((variant, index) => <span key={variant.id} className="inline-flex items-center">{index > 0 && <span className="mx-1 text-muted-foreground">·</span>}<Link href={`/candidate/cvs/${variant.id}`} title={`${variant.locale} · v${variant.version}`} className={`font-semibold ${variant.current ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{variant.language.toUpperCase()}</Link></span>) : <span className="font-semibold text-muted-foreground">{cv.language?.toUpperCase() || '—'}</span>}</div>
        {cv.workingDraftId && <Link href={`/candidate/cvs/drafts/${cv.workingDraftId}`} className="mb-3 inline-flex w-fit rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">Modification en cours · Reprendre</Link>}
        <PremiumAiAction feature="career.builder" href={`/candidate/cvs/${cv.id}/ai`} title="Améliorer avec EasyJob" description="Analyse ton CV, améliore sa clarté et adapte-le davantage au poste ciblé." className="mb-3 h-8 w-fit px-3 text-xs" />
        <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Modifié le {new Date(cv.updatedAt || cv.createdAt).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>Version actuelle : v{cv.version}</span></div>
      </li>; })}
    </ul>}
    <p className="text-xs text-muted-foreground">Import PDF avec texte sélectionnable{policy.data && ` · ${policy.data.maxBytes / 1024 / 1024} Mo maximum`}. Ton fichier original est conservé.</p>
  </CareerFrame>;
}
