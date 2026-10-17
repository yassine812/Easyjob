'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { careerApi, type StarStory } from '@/lib/api/career';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const blank = { title: '', situation: '', task: '', action: '', result: '' };

export function StarStoryBank() {
  const qc = useQueryClient(); const query = useQuery({ queryKey: ['star-stories'], queryFn: careerApi.starStories }); const [draft, setDraft] = useState(blank); const [open, setOpen] = useState(false);
  const create = useMutation({ mutationFn: () => careerApi.createStarStory(draft), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['star-stories'] }); setDraft(blank); setOpen(false); toast.success('Histoire STAR enregistrée'); }, onError: () => toast.error('Complétez les quatre sections STAR.') });
  const remove = useMutation({ mutationFn: (id: string) => careerApi.deleteStarStory(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['star-stories'] }); } });
  const update = (key: keyof typeof blank, value: string) => setDraft(current => ({ ...current, [key]: value }));
  return <section className="rounded-xl border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Histoires STAR</h2><p className="mt-1 text-sm text-muted-foreground">Vos exemples réels pour préparer les questions comportementales.</p></div><Button size="sm" variant="outline" onClick={() => setOpen(current => !current)}><Plus className="me-1.5 size-4" />Ajouter</Button></div>{open && <div className="mt-4 grid gap-3 rounded-lg border bg-muted/20 p-4"><Input placeholder="Titre" value={draft.title} onChange={event => update('title', event.target.value)} />{(['situation', 'task', 'action', 'result'] as const).map(key => <Textarea key={key} placeholder={key === 'situation' ? 'Situation' : key === 'task' ? 'Tâche' : key === 'action' ? 'Action' : 'Résultat'} value={draft[key]} onChange={event => update(key, event.target.value)} />)}<Button disabled={create.isPending} onClick={() => create.mutate()}>Enregistrer</Button></div>}{query.data?.length ? <div className="mt-4 space-y-3">{query.data.map((story: StarStory) => <article key={story.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><h3 className="font-medium">{story.title}</h3><Button aria-label="Supprimer" size="icon" variant="ghost" onClick={() => remove.mutate(story.id)}><Trash2 className="size-4" /></Button></div><p className="mt-2 text-sm text-muted-foreground"><strong>S</strong> {story.situation} · <strong>T</strong> {story.task} · <strong>A</strong> {story.action} · <strong>R</strong> {story.result}</p></article>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Aucune histoire enregistrée.</p>}</section>;
}
