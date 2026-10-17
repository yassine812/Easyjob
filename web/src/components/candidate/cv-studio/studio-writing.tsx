'use client';
import { useQuery } from '@tanstack/react-query';
import { Check, Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { studioApi, type CvDocument, type WritingIssue } from '@/lib/api/cv-studio';

function replaceAt(value: string, issue: WritingIssue) {
  if (!issue.replacement || value.slice(issue.offset, issue.offset + issue.length) !== issue.before) return value;
  return value.slice(0, issue.offset) + issue.replacement + value.slice(issue.offset + issue.length);
}
export function applyWritingIssue(document: CvDocument, issue: WritingIssue): CvDocument {
  const next = structuredClone(document), parts = issue.field.split(':');
  if (issue.field === 'personal.title') next.personal.title = replaceAt(next.personal.title, issue);
  else if (issue.field === 'personal.extra') next.personal.extra = replaceAt(next.personal.extra, issue);
  else if (parts[0] === 'entry') {
    const entry = next.sections.find(section => section.id === parts[1])?.entries.find(item => item.id === parts[2]);
    if (entry && (parts[3] === 'title' || parts[3] === 'text')) entry[parts[3]] = replaceAt(entry[parts[3]], issue);
  } else if (parts[0] === 'bullet') {
    const bullet = next.sections.find(section => section.id === parts[1])?.entries.find(item => item.id === parts[2])?.bullets.find(item => item.id === parts[3]);
    if (bullet) bullet.text = replaceAt(bullet.text, issue);
  }
  return next;
}

const labels = { spelling: 'Orthographe', grammar: 'Grammaire', punctuation: 'Ponctuation', repetition: 'Répétition' };
export function StudioWriting({ draftId, version, document, stale, onChange, onFocus }: { draftId: string; version: number; document: CvDocument; stale: boolean; onChange: (document: CvDocument) => void; onFocus: (id: string) => void }) {
  const quality = useQuery({ queryKey: ['cv-writing-quality', draftId, version], queryFn: () => studioApi.writingQuality(draftId), enabled: !stale, staleTime: Infinity });
  if (stale) return <p className="rounded-lg border p-4 text-xs leading-5 text-muted-foreground">Enregistrement des modifications… Le contrôle linguistique se relance après la pause de saisie.</p>;
  if (quality.isPending) return <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Analyse de la langue du CV…</p>;
  if (quality.isError) return <div className="rounded-lg border p-4 text-xs"><p role="alert">Le contrôle linguistique est momentanément indisponible.</p><Button size="sm" variant="outline" className="mt-3" onClick={() => quality.refetch()}>Réessayer</Button></div>;
  const issues = quality.data.issues;
  return <div className="space-y-4"><div><div className="flex items-center gap-2"><Languages className="size-4 text-primary" /><h2 className="text-sm font-semibold">Qualité rédactionnelle</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{quality.data.provider === 'languagetool' ? 'Vérification LanguageTool' : 'Vérification locale'} · {quality.data.locale}. Les corrections restent séparées de l’analyse ATS et des propositions EasyJob.</p></div>
    {!issues.length ? <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4"><p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><Check className="size-4" />Aucune erreur déterministe détectée</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Le ton, la clarté et l’impact professionnel peuvent encore être travaillés avec EasyJob.</p></div> : <div className="space-y-3">{issues.map(issue => <article key={issue.id} className="rounded-lg border p-3"><button className="text-start" onClick={() => onFocus(issue.blockId.includes('-') ? issue.blockId.split('-')[0] : 'personal')}><span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Aa · {labels[issue.category]}</span><p className="mt-2 text-xs font-medium">{issue.message}</p><p className="mt-1 text-xs text-muted-foreground"><s>{issue.before}</s>{issue.replacement && <> → <strong className="text-foreground">{issue.replacement}</strong></>}</p></button>{issue.replacement && <Button size="sm" variant="outline" className="mt-3" onClick={() => onChange(applyWritingIssue(document, issue))}>Corriger</Button>}</article>)}</div>}
    <div className="flex flex-wrap gap-1.5">{quality.data.dimensions.map(dimension => <span key={dimension} className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground">{dimension}</span>)}</div>
  </div>;
}
