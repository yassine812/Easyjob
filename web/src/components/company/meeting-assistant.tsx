'use client';
import { EasyJobFeatureLabel } from '@/components/ui/easyjob-feature-mark';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Info, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EasyJobLoader } from '@/components/ui/easyjob-loader';
import { meetingQuestions, type Meeting } from './meeting-types';
import { useMeetingText } from './meeting-copy';
import styles from './meeting-room.module.css';
import { QuestionReason } from './question-reason';
import { PublicContextPanel } from './public-context-panel';
import { externalResearchApi } from '@/lib/api/external-research';

export function MeetingAssistant({ meeting, running, open, onOpenChange, onPrivacy }: { meeting: Meeting; running: boolean; open: boolean; onOpenChange: (open: boolean) => void; onPrivacy: () => void }) {
  const t = useMeetingText(), { locale } = useI18n(), queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false), [tab, setTab] = useState('brief');
  const activeTab = running ? 'questions' : tab;
  const [notes, setNotes] = useState(meeting.assistantNotes?.notes ?? '');
  const [covered, setCovered] = useState<number[]>(meeting.assistantNotes?.covered ?? []);
  const [saved, setSaved] = useState(true), revision = useRef(0), dirty = useRef(false);
  const questions = meetingQuestions(meeting), href = `/company/${meeting.companyId}/applications/${meeting.applicationId}`;
  const publicContext = useQuery({ queryKey: ['external-research', 'interview', meeting.id], queryFn: () => externalResearchApi.interview(meeting.id), enabled: Boolean(open && meeting.assistantEnabled), refetchInterval: query => query.state.data?.status === 'QUEUED' ? 4000 : false, staleTime: 15000 });
  const refreshPublicContext = useMutation({ mutationFn: () => api.post(`/interviews/${meeting.id}/brief/research`), onSuccess: () => { void publicContext.refetch(); } });
  const publicTechnologies = [...new Set(publicContext.data?.technologies ?? [])].filter(Boolean);
  const evidencedSkills = new Set(questions.map(question => question.skill?.toLowerCase()).filter(Boolean));
  const publicQuestions = publicTechnologies.filter(technology => !evidencedSkills.has(technology.toLowerCase())).slice(0, 3);
  const latest = useRef({ notes, covered, locale, revision: 0 });
  const save = useMutation({
    scope: { id: `meeting-notes-${meeting.id}` },
    mutationFn: (draft: typeof latest.current) => api.post(`/meetings/${meeting.id}/notes`, { notes: draft.notes, covered: draft.covered, locale: draft.locale }),
    onSuccess: (_, draft) => { if (draft.revision === revision.current) { setSaved(true); dirty.current = false; } void queryClient.invalidateQueries({ queryKey: ['meeting', meeting.id] }); },
    onError: () => toast.error(t('saveFailed')),
  });
  const { mutate: saveDraft } = save;
  useEffect(() => { const media = window.matchMedia('(max-width: 1100px)'); const update = () => setCompact(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => saveDraft(latest.current), 800);
    return () => window.clearTimeout(timer);
  }, [notes, covered, saveDraft]);
  // Flush edits when leaving the workspace; queued mutations retain save order.
  const flush = useCallback((draft: typeof latest.current) => saveDraft(draft), [saveDraft]);
  useEffect(() => () => { if (dirty.current) flush(latest.current); }, [flush]);
  const edit = (nextNotes: string, nextCovered: number[]) => {
    dirty.current = true; setSaved(false); revision.current++;
    latest.current = { notes: nextNotes, covered: nextCovered, locale, revision: revision.current };
    setNotes(nextNotes); setCovered(nextCovered);
  };
  const score = meeting.candidateSummary?.score ?? (meeting.brief?.analysisSnapshot?.score != null ? Math.round(meeting.brief.analysisSnapshot.score * 100) : null);
  const body = <>
    <header className={styles.assistantHeader}><div><h2 className="flex items-center gap-2 text-sm font-semibold"><EasyJobFeatureLabel>{t('assistant')}</EasyJobFeatureLabel></h2><p className="mt-1 text-[11px] text-muted-foreground">{t('included')}</p></div><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t('privacy')} onClick={onPrivacy}><Info className="size-4" /></Button></TooltipTrigger><TooltipContent>{t(meeting.transcriptionAvailable ? 'consentHelp' : 'transcriptionUnavailable')}</TooltipContent></Tooltip></header>
    <div className={styles.snapshot}><span className={styles.avatar}>{meeting.candidateName.split(/\s+/).map(word => word[0]).slice(0, 2).join('')}</span><div className="min-w-0"><p className="text-sm font-medium">{meeting.candidateName}</p><p className="truncate text-xs text-muted-foreground" title={meeting.title}>{meeting.title}</p></div></div>
    <Tabs value={activeTab} onValueChange={setTab} className={styles.assistantBody}>
      <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="brief">{t('briefTab')}</TabsTrigger><TabsTrigger value="questions">{t('questionsTab')}</TabsTrigger><TabsTrigger value="notes">{t('notesTab')}</TabsTrigger></TabsList>
      <TabsContent value="brief" className={styles.scroll}><div className="space-y-6">
        <section><h3 className={styles.sectionTitle}>{t('synthesis')}</h3><dl className={styles.summary}><div><dt>{t('match')}</dt><dd className="text-primary">{score != null ? `${score}%` : '—'}</dd></div>{meeting.candidateSummary?.potential && <div><dt>{t('potential')}</dt><dd>{t(`potential${meeting.candidateSummary.potential}`)}</dd></div>}{meeting.candidateSummary?.classification && <div><dt>{t('classification')}</dt><dd>{t(meeting.candidateSummary.classification)}</dd></div>}</dl></section>
        {(['strengths', 'gaps'] as const).map(key => <section key={key}><h3 className={styles.sectionTitle}>{t(key === 'gaps' ? 'verify' : key)}</h3><div className="flex flex-wrap gap-1.5">{meeting.brief?.[key]?.length ? meeting.brief[key].slice(0, 6).map((entry, index) => <span className="rounded-md bg-muted px-2 py-1 text-xs" key={index}>{entry.label.replace(/^custom[_ ]+/i, '')}</span>) : <p className="text-xs text-muted-foreground">{t('noEvidence')}</p>}</div></section>)}
        <PublicContextPanel result={publicContext.data} isLoading={publicContext.isLoading} isError={publicContext.isError} onRefresh={() => refreshPublicContext.mutate()} />
        {publicQuestions.length > 0 && <section className="space-y-3"><h3 className={styles.sectionTitle}>{t('publicQuestion')}</h3>{publicQuestions.map(technology => <div className="rounded-lg border border-primary/20 bg-primary/5 p-3" key={technology}><p className="text-sm font-medium">{locale === 'fr' ? `Quelle expérience avez-vous avec ${technology} en production ?` : locale === 'ar' ? `ما تجربتك مع ${technology} في بيئة الإنتاج؟` : `What experience do you have with ${technology} in production?`}</p><p className="mt-2 text-xs text-muted-foreground">{t('publicQuestionWhy')}: {locale === 'fr' ? `${technology} apparaît dans le contexte technique public de l’entreprise, mais n’est pas démontré dans le brief candidat.` : locale === 'ar' ? `${technology} موجودة في السياق التقني العمومي للشركة، أما ما ظهرتش في ملف المترشح.` : `${technology} appears in the company's public technical context, but is not demonstrated in the candidate brief.`}</p></div>)}</section>}
        {meeting.candidateSummary?.coverLetter && <section><h3 className={styles.sectionTitle}>{t('coverLetter')}</h3><p className="line-clamp-4 text-xs leading-6 text-muted-foreground">{meeting.candidateSummary.coverLetter}</p></section>}
        <div className="grid gap-2"><Button asChild size="sm" variant="outline"><Link href={`${href}?tab=aiAnalysis`}>{t('viewAnalysis')}</Link></Button><Button asChild size="sm" variant="ghost"><Link href={`${href}?tab=cv`}>{t('viewCv')}</Link></Button></div>
      </div></TabsContent>
      <TabsContent value="questions" className={styles.scroll}><p className="mb-4 text-xs text-muted-foreground">{t('discussed')} · {covered.filter(index => index < questions.length).length}/{questions.length}</p>{['HIGH', 'MEDIUM', 'OPTIONAL'].map(priority => {
        const group = questions.map((question, index) => ({ question, index })).filter(({ question }) => (['HIGH', 'OPTIONAL'].includes(question.priority) ? question.priority : 'MEDIUM') === priority);
        return group.length ? <section className="mb-5" key={priority}><h3 className="flex justify-between text-xs font-semibold">{t(priority)}<span className="text-muted-foreground">{group.length}</span></h3>{group.map(({ question, index }) => <div className={styles.question} key={question.id}><Checkbox id={`question-${question.id}`} className="mt-1" checked={covered.includes(index)} disabled={meeting.status === 'CANCELLED'} onCheckedChange={value => edit(notes, value ? [...covered, index] : covered.filter(i => i !== index))} /><div className="min-w-0"><label htmlFor={`question-${question.id}`}>{question.question}</label>{question.sourceType !== 'RECRUITER' && <QuestionReason reason={question.reason} />}</div></div>)}</section> : null;
      })}</TabsContent>
      <TabsContent value="notes" className={styles.scroll}><label className="grid gap-3 text-sm font-medium">{t('privateNotes')}<Textarea value={notes} onChange={event => edit(event.target.value, covered)} placeholder={t('notesHint')} maxLength={15000} rows={14} disabled={meeting.status === 'CANCELLED'} className="min-h-64 resize-y text-sm font-normal leading-6" /></label></TabsContent>
      <div role="status" className="flex min-h-7 items-center justify-end text-[11px] text-muted-foreground">{save.isPending ? <EasyJobLoader width={72} height={24} label={t('saving')} /> : save.isError ? <button className="text-destructive underline" onClick={() => save.mutate(latest.current)}>{t('saveFailed')} {t('retry')}</button> : t(saved ? 'saved' : 'unsaved')}</div>
    </Tabs>
    <footer className="border-t px-5 py-3"><button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={onPrivacy}><ShieldCheck className="size-3.5" />{t('privacy')}</button></footer>
  </>;
  return compact ? <Dialog open={open} onOpenChange={onOpenChange}><DialogContent ref={dialogRef} className={styles.sheet} style={{ translate: 'none' }} onOpenAutoFocus={event => { event.preventDefault(); dialogRef.current?.focus(); }}><DialogTitle className="sr-only">{t('assistant')}</DialogTitle><DialogDescription className="sr-only">{meeting.candidateName}</DialogDescription>{body}</DialogContent></Dialog> : <aside className={styles.assistant}>{body}</aside>;
}
