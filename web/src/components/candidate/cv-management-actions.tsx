'use client';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Eye, History, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { resumesApi } from '@/lib/api/resumes';
import type { Resume } from '@/types/api';
import { PremiumAiAction } from './career-shared';

export function AtsScoreRing({ score, pending = false, size = 56 }: { score?: number | null; pending?: boolean; size?: number }) {
  const value = score != null && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
  return <div role="img" aria-label={pending ? 'Analyse ATS en cours' : value == null ? 'Score ATS indisponible' : `Score ATS : ${value} sur 100`} className="relative shrink-0" style={{ width: size, height: size }}>
    <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" /><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(value ?? 0) * 1.696} 169.6`} className={pending ? 'text-primary opacity-40' : 'text-primary'} /></svg>
    <span className="absolute inset-0 flex flex-col items-center justify-center leading-none"><strong className="text-base tabular-nums">{pending ? '…' : value ?? '—'}</strong><small className="mt-1 text-[9px] text-muted-foreground">/100</small></span>
  </div>;
}
export function CvEditChoice({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Modifier le CV</DialogTitle><DialogDescription>Choisis ton mode de travail. Le fichier original est conservé.</DialogDescription></DialogHeader><div className="divide-y">
    <Link onClick={() => onOpenChange(false)} href={`/candidate/cvs/${id}/edit`} className="flex gap-4 rounded-lg px-2 py-5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><Pencil className="mt-1 size-5 shrink-0 text-primary" /><span><strong className="block text-sm">Modifier manuellement</strong><span className="mt-1 block text-sm text-muted-foreground">Contenu, rubriques, modèles et mise en page.</span></span></Link>
    <PremiumAiAction feature="career.builder" href={`/candidate/cvs/${id}/ai`} title="Améliorer avec EasyJob" description="Analyse ton CV, améliore sa clarté et adapte-le davantage au poste ciblé." className="h-auto w-full justify-start rounded-lg px-2 py-5 text-left hover:bg-muted" />
  </div></DialogContent></Dialog>;
}
export function CvActionsMenu({ resume, onDeleted }: { resume: Resume; onDeleted?: () => void }) {
  const qc = useQueryClient(), router = useRouter();
  const [dialog, setDialog] = useState<'edit' | 'history' | 'rename' | 'delete' | null>(null), [name, setName] = useState('');
  const versions = useQuery({ queryKey: ['resume-versions', resume.id], queryFn: () => resumesApi.versions(resume.id), enabled: dialog === 'history' });
  async function download(id = resume.id) { const file = await resumesApi.downloadUrl(id); const a = document.createElement('a'); a.href = file.url; a.download = file.filename; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
  const action = useMutation({ mutationFn: async (kind: string) => {
    if (kind === 'primary') return resumesApi.setPrimary(resume.id);
    if (kind === 'rename') return resumesApi.rename(resume.id, name);
    if (kind === 'delete') return resumesApi.remove(resume.id);
    if (kind === 'duplicate') return resumesApi.duplicate(resume.id);
    if (kind.startsWith('restore:')) return resumesApi.restore(resume.id, kind.slice(8));
    return download();
  }, onSuccess: async (_, kind) => { if (!kind.startsWith('restore:')) setDialog(null); if (kind !== 'download') await Promise.all(['resumes', 'resume-versions', 'career-overview', 'candidate-profile'].map(key => qc.invalidateQueries({ queryKey: [key] }))); if (kind === 'delete') onDeleted?.(); } });
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" disabled={action.isPending} aria-label={`Actions pour ${resume.filename}`}><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64">
      <DropdownMenuItem onSelect={() => router.push(`/candidate/cvs/${resume.id}`)}><Eye className="size-4" />Voir le CV</DropdownMenuItem>
      <DropdownMenuItem disabled={resume.processingStatus !== 'COMPLETED'} onSelect={() => setDialog('edit')}><Pencil className="size-4" />Modifier</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setDialog('history')}><History className="size-4" />Historique des versions</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => action.mutate('duplicate')}><Copy className="size-4" />Dupliquer le CV</DropdownMenuItem>
      {!resume.isPrimary && <DropdownMenuItem onSelect={() => action.mutate('primary')}><Star className="size-4" />Définir comme CV principal</DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => action.mutate('download')}><Download className="size-4" />Télécharger</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => { action.reset(); setName(resume.filename.replace(/\.[^.]+$/, '')); setDialog('rename'); }}><Pencil className="size-4" />Renommer</DropdownMenuItem><DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => { action.reset(); setDialog('delete'); }}><Trash2 className="size-4" />Supprimer</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    {action.isError && !dialog && <p role="alert" className="text-xs text-destructive">Action impossible. Réessaie depuis le menu.</p>}
    <CvEditChoice id={resume.id} open={dialog === 'edit'} onOpenChange={open => { if (!open) setDialog(null); }} />
    <Dialog open={dialog === 'history'} onOpenChange={open => { if (!open && !action.isPending) setDialog(null); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Historique des versions</DialogTitle><DialogDescription>{resume.filename} · la restauration crée une nouvelle version et conserve tout l’historique.</DialogDescription></DialogHeader>
      <div className="max-h-[60vh] divide-y overflow-y-auto rounded-xl border">{versions.isPending ? <EasyJobLoading label="Chargement de l’historique" /> : versions.isError ? <div className="p-5 text-sm"><p role="alert">Impossible de charger les versions.</p><Button variant="outline" className="mt-3" onClick={() => versions.refetch()}>Réessayer</Button></div> : versions.data?.map(version => <article key={version.id} className="flex items-center justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><strong className="text-sm">v{version.version}</strong>{version.current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Actuelle</span>}</div><p className="mt-1 text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString('fr', { dateStyle: 'medium', timeStyle: 'short' })}{version.score != null ? ` · ATS ${version.score}/100` : ''}</p>{version.version === 1 && <p className="mt-1 text-[11px] text-muted-foreground">Version initiale</p>}</div><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={() => void download(version.id)}><Eye className="me-1.5 size-3.5" />Voir</Button>{!version.current && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate(`restore:${version.id}`)}><RotateCcw className="me-1.5 size-3.5" />Restaurer</Button>}</div></article>)}</div>
      {action.isError && <p role="alert" className="text-sm text-destructive">L’action n’a pas pu être terminée. Réessaie.</p>}
      <DialogFooter><Button variant="outline" disabled={action.isPending} onClick={() => setDialog(null)}>Fermer</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={dialog === 'rename' || dialog === 'delete'} onOpenChange={open => { if (!open && !action.isPending) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === 'rename' ? 'Renommer le CV' : 'Supprimer ce CV ?'}</DialogTitle><DialogDescription className="break-all">{resume.filename}</DialogDescription></DialogHeader>
      {dialog === 'rename' && <label className="space-y-2 text-sm">Nom du CV<Input autoFocus value={name} maxLength={145} onChange={e => setName(e.target.value)} /></label>}
      {action.isError && <p role="alert" className="text-sm text-destructive">{action.error.message}</p>}
      <DialogFooter><Button variant="outline" disabled={action.isPending} onClick={() => setDialog(null)}>Annuler</Button><Button variant={dialog === 'delete' ? 'destructive' : 'default'} disabled={action.isPending || dialog === 'rename' && !name.trim()} onClick={() => action.mutate(dialog!)}>{action.isPending ? 'Enregistrement…' : dialog === 'rename' ? 'Renommer' : 'Supprimer'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
