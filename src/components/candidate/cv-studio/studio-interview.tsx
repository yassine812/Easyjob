'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Check, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { studioApi, type StudioDraft } from '@/lib/api/cv-studio';

export function StudioInterview({ draft, onSaved, onFinish }: { draft: StudioDraft; onSaved: (draft: StudioDraft) => void; onFinish: () => void }) {
  const [answer, setAnswer] = useState(''), [editingKey, setEditingKey] = useState<string | null>(null);
  const previous = draft.document.interview.find(a => a.key === editingKey);
  const question = previous ? { key: previous.key, question: previous.question, optional: true } : draft.nextQuestion;
  const submit = useMutation({ mutationFn: (value: string) => studioApi.answer(draft.id, { expectedVersion: draft.version, key: question!.key, answer: value }), onSuccess: next => { onSaved(next); setAnswer(''); setEditingKey(null); } });
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">EasyJob · Construction guidée</p><h2 className="mt-2 text-xl font-semibold">Ton CV prend forme</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Chaque réponse est enregistrée et rejoint ton CV. Tu pourras ajouter d’autres expériences et ajuster chaque rubrique dans l’éditeur.</p></div>
    {!!draft.document.interview.length && <details><summary className="cursor-pointer text-xs text-muted-foreground">Revoir mes réponses ({draft.document.interview.length})</summary><div className="mt-3 space-y-3">{draft.document.interview.map(a => <div key={a.key} className="border-s-2 ps-3"><p className="text-xs text-muted-foreground">{a.question}</p><p className="mt-1 whitespace-pre-wrap text-sm">{a.answer || 'Étape passée'}</p><Button size="sm" variant="ghost" className="mt-1 h-8 text-xs" disabled={submit.isPending} onClick={() => { setEditingKey(a.key); setAnswer(a.answer); }}><Pencil className="me-1 size-3" />Corriger</Button></div>)}</div></details>}
    {question ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit.mutate(answer); }}><div className="rounded-xl bg-primary/5 px-4 py-4"><label htmlFor="cv-interview-answer" className="text-sm font-medium leading-6">{question.question}</label></div><Textarea id="cv-interview-answer" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Ta réponse…" maxLength={4000} className="min-h-28" /><div className="flex flex-wrap items-center gap-2">{question.optional && <Button type="button" variant="ghost" disabled={submit.isPending} onClick={() => submit.mutate('')}>Passer</Button>}<Button type="submit" className="ms-auto" disabled={submit.isPending || !answer.trim()}>{submit.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}Continuer<ArrowRight className="ms-2 size-4" /></Button></div></form> : <div className="space-y-4"><Check className="size-7 text-primary" /><h3 className="font-semibold">Tes informations sont réunies.</h3><p className="text-sm leading-6 text-muted-foreground">Choisis un modèle, puis affine ton profil et tes réalisations avec EasyJob. Le diagnostic ATS t’indique les points encore à renforcer.</p><Button onClick={onFinish}>Affiner mon CV<ArrowRight className="ms-2 size-4" /></Button></div>}
    {submit.isError && <p role="alert" className="text-sm text-destructive">Impossible d’enregistrer cette réponse. {submit.error.message}</p>}
    <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground">{submit.isPending ? 'Enregistrement…' : <><Check className="size-3" />Progression enregistrée · v{draft.version}</>}</p>
  </div>;
}
