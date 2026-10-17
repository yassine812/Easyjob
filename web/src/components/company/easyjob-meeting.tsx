'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NativeMeetingRoom, type MeetingAccess, type DevicePreferences } from './native-meeting-room';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Clock3, FileText, MoreHorizontal, ShieldCheck, Video } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useI18n, LanguageToggle } from '@/lib/i18n';
import { useRole } from '@/hooks/use-auth';
import { RequireAuth } from '@/components/shared/guards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/layout/logo';
import { EasyJobLoading, EasyJobLoader } from '@/components/ui/easyjob-loader';
import { MeetingTranscription } from './meeting-transcription';
import { FeedbackEditor, InterviewEditor } from './interview-scheduler';
import { MeetingDevices } from './meeting-devices';
import { MeetingAssistant } from './meeting-assistant';
import { meetingQuestions, meetingTime, type Meeting } from './meeting-types';
import { useMeetingText } from './meeting-copy';
import styles from './meeting-room.module.css';

export function EasyJobMeeting() { return <RequireAuth><MeetingContent /></RequireAuth>; }
export function MeetingContent() {
  const { id } = useParams<{ id: string }>(), t = useMeetingText(), { locale } = useI18n(), qc = useQueryClient(), { can } = useRole();
  const result = useQuery({ queryKey: ['meeting', id, locale], queryFn: () => api.get<Meeting>(`/meetings/${id}?locale=${locale}`), refetchInterval: 10000 });
  const [devices, setDevices] = useState<DevicePreferences>({});
  const [assistantVisible, setAssistantVisible] = useState(true);
  const [muted, setMuted] = useState(true), [access, setAccess] = useState<MeetingAccess | null>(null), [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState<'COMPLETED' | 'CANCELLED' | null>(null), [evaluate, setEvaluate] = useState(false), [reschedule, setReschedule] = useState(false);
  const [privacy, setPrivacy] = useState(false), [assistantOpen, setAssistantOpen] = useState(false), [now, setNow] = useState(Date.now());
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['meeting', id] });
  const leave = () => { setAccess(null); setRunning(false); setMuted(true); };
  const join = useMutation({ mutationFn: () => api.post<MeetingAccess>(`/meetings/${id}/join`, {}), onSuccess: setAccess, onError: (error: Error) => toast.error(t('saveError')) });
  const consent = useMutation({ mutationFn: (accepted: boolean) => api.post(`/meetings/${id}/consent`, { accepted }), onSuccess: () => { invalidate(); setPrivacy(false); }, onError: (error: Error) => toast.error(t('saveError')) });
  const transition = useMutation({ mutationFn: (status: string) => api.patch(`/interviews/${id}`, { status }), onSuccess: () => { leave(); setConfirm(null); invalidate(); }, onError: (error: Error) => toast.error(t('saveError')) });
  const data = result.data;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (data && !['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(data.status)) leave(); }, [data?.status]);
  const download = async () => {
    try { const file = await api.get<{ content: string; filename: string }>(`/meetings/${id}/calendar`); const url = URL.createObjectURL(new Blob([file.content], { type: 'text/calendar' })); const a = document.createElement('a'); a.href = url; a.download = file.filename; a.click(); URL.revokeObjectURL(url); }
    catch { toast.error(t('saveError')); }
  };
  if (result.isPending) return <main className="p-8"><EasyJobLoading label={t('loading')} /></main>;
  if (result.isError || !data) return <main className="p-8"><p role="alert">{t('saveError')}</p><Button onClick={() => void result.refetch()}>{t('retry')}</Button></main>;
  const active = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(data.status), completed = data.status === 'COMPLETED';
  const editable = !data.candidate && can(data.companyId, 'interview.update');
  const hasAssistant = !data.candidate && data.assistantEnabled;
  const back = data.candidate ? `/candidate/applications/${data.applicationId}` : `/company/${data.companyId}/interviews`;
  const dossier = `/company/${data.companyId}/applications/${data.applicationId}`;
  const opens = new Date(data.startAt).getTime() - 15 * 60000, closes = new Date(data.endAt).getTime() + 30 * 60000;
  const early = now < opens, expired = now >= closes;
  const opensTime = new Date(opens).toLocaleTimeString(locale, { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
  const roomAvailable = data.joinAvailable && !early && !expired;
  const wantsConsent = data.assistantEnabled && !data.consented;
  return <main className={styles.page}>
    <div className={styles.topbar}><div className={styles.brand}><Logo href={back} size="sm" /><span>EasyJob Interview</span></div><LanguageToggle /></div>
    <div className={styles.content}>
      <Link className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground" href={back}><ArrowLeft className="size-3.5" />{t('interviews')}</Link>
      <header className={styles.heading}><div className="min-w-0"><div className={styles.identity}><h1>{data.title}</h1><Badge variant="secondary">{t(running || data.status === 'IN_PROGRESS' ? 'live' : data.status)}</Badge></div><p className={styles.subline}>{data.candidateName} · {data.companyName}</p><p className={`${styles.subline} flex flex-wrap items-center gap-2`}><Clock3 className="size-3.5" />{new Date(data.startAt).toLocaleDateString(locale, { timeZone: data.timezone, day: 'numeric', month: 'short', year: 'numeric' })} · {meetingTime(data, locale)} · {data.timezone}</p></div>
        <div className={styles.actions}>{!data.candidate && <><Button asChild variant="outline" size="sm"><Link href={dossier}><FileText className="size-4" />{t('viewDossier')}</Link></Button><Button asChild variant="ghost" size="sm"><Link href={`${dossier}?tab=cv`}>{t('viewCv')}</Link></Button></>}{hasAssistant && <Button size="sm" variant="outline" aria-expanded={assistantVisible} onClick={() => window.innerWidth < 1100 ? setAssistantOpen(true) : setAssistantVisible(value => !value)}><EasyJobFeatureMark size="sm" className="" />{t('showAssistant')}</Button>}
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t('more')}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void download()}>{t('calendarDownload')}</DropdownMenuItem>{active && editable && <><DropdownMenuItem onSelect={() => setReschedule(true)}>{t('reschedule')}</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => setConfirm('CANCELLED')}>{t('cancelInterview')}</DropdownMenuItem></>}{data.assistantEnabled && <DropdownMenuItem onSelect={() => setPrivacy(true)}>{t('privacy')}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
      </header>
      <div className={`${styles.workspace} ${hasAssistant && assistantVisible ? '' : styles.workspaceSolo}`}>
        <section className={styles.stage}>
          {access ? <><NativeMeetingRoom access={access} devices={devices} onLeave={leave} onMute={setMuted} onJoined={() => { setRunning(true); if (!data.candidate) void api.post(`/meetings/${id}/started`, {}).then(invalidate).catch(() => { toast.error(t('saveError')); leave(); }); }} />{data.assistantEnabled && data.transcriptionAvailable && <MeetingTranscription id={id} ready={running && data.transcriptionReady && data.consented && active} muted={muted} locale={locale} />}{running && editable && <div className="flex justify-end px-4 py-3"><Button variant="outline" size="sm" onClick={() => setConfirm('COMPLETED')}>{t('finish')}</Button></div>}</> : completed ? <MeetingReport meeting={data} onEvaluate={() => setEvaluate(true)} editable={editable} /> : active ? <div className={styles.prejoin}>
            {data.locationType === 'EASYJOB' ? <MeetingDevices devices={devices} onDevicesChange={setDevices} /> : <div className="rounded-xl bg-muted p-8"><Video className="mb-4 size-7 text-primary" /><h2 className="font-semibold">{t(data.locationType)}</h2><p className="mt-2 break-words text-sm text-muted-foreground">{data.location}</p></div>}
            <div className={styles.joinSection}><div><h2>{t(early ? 'upcomingMeeting' : expired ? 'roomExpired' : 'readyMeeting')}</h2><p>{meetingTime(data, locale)}</p>{early && <p>{t('opensAt').replace('{time}', opensTime)}</p>}</div><div className={styles.joinAction}>
              {data.locationType === 'EASYJOB' ? <Button size="lg" disabled={!roomAvailable || join.isPending} onClick={() => wantsConsent ? setPrivacy(true) : join.mutate()}>{join.isPending ? <EasyJobLoader width={100} height={28} /> : <><Video className="size-4" />{t(data.candidate ? 'join' : 'launch')}</>}</Button> : data.locationType === 'EXTERNAL' && data.location?.startsWith('https://') && <Button asChild><a href={data.location} target="_blank" rel="noopener noreferrer">{t('join')}</a></Button>}
              {early ? <small>{t('availableIn').replace('{minutes}', String(Math.ceil((opens - now) / 60000)))}</small> : !expired && wantsConsent && <button className="text-xs text-muted-foreground underline" onClick={() => setPrivacy(true)}>{t('consentRequired')}</button>}
            </div></div>
          </div> : <div className="p-10"><h2 className="text-xl font-semibold">{t(data.status)}</h2><p className="mt-3 text-sm text-muted-foreground">{t('roomExpired')}</p></div>}
        </section>
        {hasAssistant && <div style={{ display: assistantVisible ? 'contents' : 'none' }}><MeetingAssistant key={id} meeting={data} running={running} open={assistantOpen} onOpenChange={setAssistantOpen} onPrivacy={() => setPrivacy(true)} /></div>}
      </div>
    </div>
    <Dialog open={privacy} onOpenChange={setPrivacy}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />{t('privacy')}</DialogTitle><DialogDescription>{t(data.transcriptionAvailable ? 'consentHelp' : 'transcriptionUnavailable')}</DialogDescription></DialogHeader>{active && <><p className="text-sm text-muted-foreground">{t('consentHelp')}</p><Button disabled={consent.isPending} variant={data.consented ? 'outline' : 'default'} onClick={() => { if (data.consented) leave(); consent.mutate(!data.consented); }}>{t(data.consented ? 'revokeConsent' : 'consent')}</Button></>}</DialogContent></Dialog>
    <AlertDialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(confirm === 'CANCELLED' ? 'cancelConfirm' : 'finishConfirm')}</AlertDialogTitle><AlertDialogDescription>{t(confirm === 'CANCELLED' ? 'cancelHelp' : 'finishHelp')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={transition.isPending}>{t('cancel')}</AlertDialogCancel><Button disabled={transition.isPending} onClick={() => confirm && transition.mutate(confirm)}>{t(confirm === 'CANCELLED' ? 'cancelInterview' : 'finish')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={evaluate} onOpenChange={setEvaluate}><DialogContent><DialogHeader><DialogTitle>{t('evaluate')}</DialogTitle><DialogDescription>{data.candidateName}</DialogDescription></DialogHeader><FeedbackEditor companyId={data.companyId} interviewId={id} done={() => { setEvaluate(false); invalidate(); }} /></DialogContent></Dialog>
    <Dialog open={reschedule} onOpenChange={setReschedule}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{t('reschedule')}</DialogTitle><DialogDescription>{data.candidateName}</DialogDescription></DialogHeader><InterviewEditor companyId={data.companyId} interview={{ ...data, questions: undefined, type: data.type ?? 'HR', notes: null, application: { id: data.applicationId, candidate: { user: { name: data.candidateName } }, job: { title: data.title } } }} done={() => { setReschedule(false); invalidate(); }} /></DialogContent></Dialog>
  </main>;
}

function MeetingReport({ meeting, onEvaluate, editable }: { meeting: Meeting; onEvaluate: () => void; editable: boolean }) {
  const t = useMeetingText(), questions = meetingQuestions(meeting), covered = meeting.assistantNotes?.covered ?? [], [showTranscript, setShowTranscript] = useState(false), segments = meeting.assistantNotes?.segments ?? [];
  return <div className={styles.report}><Badge variant="secondary">{t('COMPLETED')}</Badge><h2 className="mt-4 text-2xl font-semibold">{t('completedMeeting')}</h2>{!meeting.candidate && <><p className="mt-2 text-sm text-muted-foreground">{t('reportHelp')}</p>{meeting.assistantEnabled && <div className="mt-7 grid gap-6 sm:grid-cols-2">{[true, false].map(done => <section key={String(done)}><h3 className="mb-3 text-sm font-semibold">{t(done ? 'discussed' : 'notDiscussed')} · {questions.filter((_, i) => covered.includes(i) === done).length}</h3><ul className="space-y-3 text-sm text-muted-foreground">{questions.filter((_, i) => covered.includes(i) === done).map(q => <li key={q.id}>{q.question}</li>)}</ul></section>)}<section className="sm:col-span-2"><h3 className="mb-2 text-sm font-semibold">{t('privateNotes')}</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{meeting.assistantNotes?.notes || t('noNotes')}</p></section>{segments.length > 0 && <section className="sm:col-span-2"><Button variant="outline" size="sm" onClick={() => setShowTranscript(value => !value)}>{t(showTranscript ? 'hideTranscript' : 'viewTranscript')}</Button>{showTranscript && <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-sm">{segments.map((segment, index) => <p className="mb-2 last:mb-0" key={`${segment.at}-${index}`}><span className="mr-2 font-medium">{segment.speaker}</span>{segment.text}</p>)}</div>}</section>}</div>}<div className="mt-7 space-y-4">{meeting.feedback?.map(feedback => <article className="rounded-xl bg-muted p-4" key={feedback.id}><div className="mb-3 flex flex-wrap gap-4">{feedback.criteria?.map(criterion => <p key={criterion.label} className="text-xs">{criterion.label} <strong>{criterion.score}/5</strong></p>)}</div><p className="whitespace-pre-wrap text-sm">{feedback.summary}</p>{feedback.recommendation && <Badge className="mt-3" variant="outline">{t(feedback.recommendation)}</Badge>}</article>)}{editable && <Button onClick={onEvaluate}>{t('evaluate')}</Button>}</div></>}</div>;
}
