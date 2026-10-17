'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EasyJobCharacter } from '@/components/auth/easyjob-coach';
import { Captions, Code2, Mic, MicOff, PhoneOff, RotateCcw, Video, VideoOff, Keyboard, Check, AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { type CoachSession } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { useInterviewConversation } from './use-interview-conversation';
import { InterviewReport } from './interview-coach';
import styles from './interview-room.module.css';

export function InterviewRoom({ initial, stream, onComplete, onLeave, onTargetedPractice, targetedPending }: {
  initial: CoachSession; stream: MediaStream | null; onComplete?: (s: CoachSession) => void; onLeave: () => void;
  onTargetedPractice?: () => void; targetedPending?: boolean;
}) {
  const room = useInterviewConversation(initial, stream, onComplete), c = room.copy;
  const t = useCareerText();
  const [mounted, setMounted] = useState(false), [captions, setCaptions] = useState(true), [showTranscript, setShowTranscript] = useState(false), [leave, setLeave] = useState(false);
  const [camera, setCamera] = useState(!!stream?.getVideoTracks().length);
  const [framingLost, setFramingLost] = useState(false);
  const video = useRef<HTMLVideoElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const completed = room.state === 'COMPLETED' || room.session.answers.length >= room.session.questions.length;
  const autoTest = room.session.autoTest || room.autoTest;
  const busy = ['ANALYZING', 'INTERVIEWER_FEEDBACK', 'INTERVIEWER_SPEAKING'].includes(room.state);
  const coding = room.session.interviewType === 'CODING';
  const recruiterState = room.state === 'INTERVIEWER_SPEAKING' ? 'speaking' : room.state === 'ANALYZING' ? 'thinking' : room.state === 'INTERVIEWER_FEEDBACK' ? 'feedback' : ['LISTENING', 'ANSWERING'].includes(room.state) ? 'listening' : 'idle';
  const status = recruiterState === 'speaking' ? c('EasyJob te parle', 'EasyJob is speaking', 'يتحدث EasyJob') : recruiterState === 'thinking' ? c('Un instant…', 'One moment…', 'لحظة…') : recruiterState === 'feedback' ? c('Bien reçu', 'Got it', 'وصلت إجابتك') : room.muted ? c('Micro coupé', 'Microphone muted', 'الميكروفون مكتوم') : c('Je t’écoute', 'Listening to you', 'أستمع إليك');
  useEffect(() => { setMounted(true); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
  useEffect(() => { if (mounted) heading.current?.focus(); }, [mounted]);
  useEffect(() => { if (video.current && stream) video.current.srcObject = stream; }, [stream, camera, mounted]);
  useEffect(() => {
    if (!camera || !stream || !mounted) { setFramingLost(false); return; }
    let cancelled = false, misses = 0, timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const element = video.current;
      if (cancelled || !element) return;
      try {
        if (element.readyState >= 2) {
          const { observeFace } = await import('@/lib/face-guidance');
          const faces = await observeFace(element);
          // Only visibility; no gaze, emotion, appearance, identity or scoring.
          misses = faces.some(f => f.detection.box.width > element.videoWidth * .08) ? 0 : misses + 1;
          if (!cancelled) setFramingLost(misses >= 3);
        }
      } catch { return; } // Optional guidance must never block the conversation.
      if (!cancelled) timer = setTimeout(check, 3000);
    };
    timer = setTimeout(check, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [camera, stream, mounted]);
  const changeLeave = (value: boolean) => { room.suspend(value); setLeave(value); };
  const toggleCamera = () => { const next = !camera; stream?.getVideoTracks().forEach(track => { track.enabled = next; }); setCamera(next); };
  if (!mounted) return null;
  if (completed) return createPortal(<div className={styles.report}><div className={styles.reportInner}><Button variant="outline" onClick={onLeave}>{c('Fermer le bilan', 'Close report', 'إغلاق التقرير')}</Button>{autoTest && <AutoTestReport autoTest={autoTest} /> }<InterviewReport session={room.session} onTargetedPractice={onTargetedPractice} targetedPending={targetedPending} />{room.session.answers.map((answer, i) => <article className={styles.debrief} key={i}><h3>{answer.question || room.session.questions[i]}</h3><p className="whitespace-pre-wrap">{answer.answer}</p><div className="grid gap-5 sm:grid-cols-2"><div><h4>{c('Points forts', 'Strengths', 'نقاط القوة')}</h4><ul>{answer.feedback.good.map((s, n) => <li key={n}>{s}</li>)}</ul></div><div><h4>{c('À travailler', 'To work on', 'ما يحتاج إلى تحسين')}</h4><ul>{answer.feedback.improve.map((s, n) => <li key={n}>{s}</li>)}</ul></div></div></article>)}</div></div>, document.body);
  return createPortal(<section className={styles.room} aria-label={c('Salle d’entretien', 'Interview room', 'غرفة المقابلة')}>
    <header className={styles.header}><div className={styles.brand}>E<span>J</span></div><div className={styles.title}><h1 ref={heading} tabIndex={-1}>{room.session.jobTitle}</h1><p>{room.session.company} <span>· {t(room.session.interviewType)} · {autoTest ? 'Auto Test' : c('Simulation EasyJob', 'EasyJob simulation', 'محاكاة EasyJob')}</span></p></div><span className={styles.progress}>{Math.min(room.session.answers.length + 1, room.session.questions.length)} <span>/ {room.session.questions.length}</span></span><button className={styles.leave} onClick={() => changeLeave(true)}>{c('Quitter', 'Leave', 'مغادرة')}</button></header>
    {autoTest && <AutoTestToolbar state={room.state} persona={autoTest.persona} paused={room.autoPaused} onPause={() => room.setAutoPaused(true)} onResume={() => room.setAutoPaused(false)} onNext={room.nextAutoStep} onStop={() => { void room.stopAutoTest().finally(onLeave); }} />}
    <main className={`${styles.stage} ${coding ? styles.coding : ''}`}>
      <div className={styles.recruiter} data-state={recruiterState}>
        <div className={styles.status} role="status"><span />{status}</div>
        <div className={styles.avatarScene}><div className={styles.halo} /><div className={styles.avatar}><EasyJobCharacter floating pose={recruiterState === 'idle' ? 0 : 1} /></div>
          {room.state === 'INTERVIEWER_FEEDBACK' && room.notice && <div className={styles.feedback} role="status"><Check size={18} /><span>{room.notice}</span></div>}
        </div>
        <div className={styles.identity}>EasyJob <span>· {c('Ton interlocuteur', 'Your interviewer', 'محاورك')}</span></div>
        {captions && <div className={styles.caption} aria-label={c('Sous-titres du recruteur', 'Interviewer captions', 'نص كلام المحاور')}><span className={styles.quote}>“</span><p>{room.caption || '…'}</p></div>}
        {room.notice && room.state !== 'INTERVIEWER_FEEDBACK' && <p className={styles.notice} role="status">{room.notice}</p>}
      </div>
      {coding && <section className={styles.workspace}><header><Code2 size={18} /><h2>{c('Ta solution', 'Your solution', 'حلك')}</h2><span>{c('Explique ton raisonnement à voix haute', 'Think aloud as you code', 'اشرح تفكيرك بصوت عالٍ')}</span></header><textarea spellCheck={false} aria-label="Code" value={room.code} onChange={e => room.updateCode(e.target.value)} disabled={busy} maxLength={8500} placeholder={c('Écris ton code et tes cas de test ici…', 'Write your code and test cases here…', 'اكتب الكود وحالات الاختبار هنا…')} /><footer><span>{c('Code et explication seront examinés ensemble.', 'Code and explanation will be reviewed together.', 'ستتم مراجعة الكود والشرح معاً.')}</span></footer></section>}
      <aside className={styles.selfView} aria-label={c('Ton aperçu', 'Your preview', 'معاينتك')}>{camera ? <video ref={video} autoPlay playsInline muted /> : <div className={styles.audioOnly}><AudioLines /><span>{c('En audio', 'Audio only', 'صوت فقط')}</span></div>}{framingLost && <span className={styles.framing}>{c('Vérifie ton cadrage', 'Check your framing', 'تحقق من الإطار')}</span>}<span className={styles.selfLabel}>{c('Toi', 'You', 'أنت')}{room.muted && <MicOff size={13} />}</span></aside>
    </main>
    <div className={styles.response}>
      {room.error && <p role="alert" className={styles.error}>{room.error}</p>}
      {(showTranscript || room.textMode) && <div className={styles.transcript}>{room.textMode ? <textarea aria-label={c('Ta réponse', 'Your answer', 'إجابتك')} value={room.transcript} maxLength={coding ? 1400 : 10000} disabled={busy} onChange={e => room.updateTranscript(e.target.value)} placeholder={c('Écris ta réponse…', 'Type your answer…', 'اكتب إجابتك…')} /> : <p>{room.transcript || c('Ta transcription apparaîtra ici…', 'Your transcript will appear here…', 'سيظهر نص إجابتك هنا…')}</p>}</div>}
      <div className={styles.answerBar}><div className={styles.wave} aria-label={c('Niveau du micro', 'Microphone level', 'مستوى الميكروفون')}>{Array.from({ length: 13 }, (_, i) => <i key={i} style={{ height: `${4 + room.level * (12 + (i % 4) * 7)}px` }} />)}</div><button className={styles.transcriptToggle} onClick={() => setShowTranscript(v => !v)}>{showTranscript ? c('Masquer la transcription', 'Hide transcript', 'إخفاء النص') : c('Transcription', 'Transcript', 'النص')}</button><button className={styles.finish} disabled={busy || (coding ? !room.code.trim() : room.transcript.trim().length < 5)} onClick={room.finish}><Check size={16} />{coding ? c('Soumettre la solution', 'Submit solution', 'إرسال الحل') : room.error ? c('Réessayer', 'Retry', 'إعادة المحاولة') : c('J’ai terminé', 'I’m done', 'انتهيت')}</button></div>
    </div>
    <footer className={styles.controls}>
      <button aria-label={room.muted ? c('Activer le micro', 'Unmute', 'تشغيل الميكروفون') : c('Couper le micro', 'Mute', 'كتم الميكروفون')} title={c('Microphone', 'Microphone', 'الميكروفون')} aria-pressed={!room.muted} onClick={room.toggleMic} disabled={busy || !!autoTest}>{room.muted ? <MicOff /> : <Mic />}</button>
      <button aria-label={c('Caméra', 'Camera', 'الكاميرا')} title={stream?.getVideoTracks().length ? c('Caméra', 'Camera', 'الكاميرا') : c('Mode audio', 'Audio mode', 'وضع الصوت')} aria-pressed={camera} disabled={!stream?.getVideoTracks().length} onClick={toggleCamera}>{camera ? <Video /> : <VideoOff />}</button>
      <button aria-label={c('Sous-titres', 'Captions', 'الترجمة')} title={c('Sous-titres', 'Captions', 'الترجمة')} aria-pressed={captions} onClick={() => setCaptions(v => !v)}><Captions /></button>
      <button aria-label={c('Réécouter la question', 'Repeat question', 'إعادة السؤال')} title={c('Réécouter', 'Replay', 'إعادة')} onClick={room.replay} disabled={busy && room.state !== 'INTERVIEWER_SPEAKING'}><RotateCcw /></button>
      <button aria-label={c('Répondre par écrit', 'Type an answer', 'إجابة كتابية')} title={c('Répondre par écrit', 'Type an answer', 'إجابة كتابية')} aria-pressed={room.textMode} disabled={busy} onClick={room.enableText}><Keyboard /></button>
      <button className={styles.end} aria-label={c('Quitter l’entretien', 'Leave interview', 'مغادرة المقابلة')} title={c('Quitter', 'Leave', 'مغادرة')} onClick={() => changeLeave(true)}><PhoneOff /></button>
    </footer>
    <Dialog open={leave} onOpenChange={changeLeave}><DialogContent><DialogTitle>{c('Quitter l’entretien ?', 'Leave the interview?', 'مغادرة المقابلة؟')}</DialogTitle><DialogDescription>{c('Tu pourras reprendre ta session depuis ton historique.', 'You can resume your session from your history.', 'يمكنك استئناف الجلسة من سجلك.')}</DialogDescription><DialogFooter><Button variant="outline" onClick={() => changeLeave(false)}>{c('Continuer', 'Continue', 'متابعة')}</Button><Button variant="destructive" onClick={async () => { await room.checkpoint(); onLeave(); }}>{c('Quitter', 'Leave', 'مغادرة')}</Button></DialogFooter></DialogContent></Dialog>
  </section>, document.body);
}

function AutoTestToolbar({ state, persona, paused, onPause, onResume, onNext, onStop }: { state: string; persona: string; paused: boolean; onPause: () => void; onResume: () => void; onNext: () => void; onStop: () => void }) {
  return <aside className={styles.autoToolbar} aria-label="Automated interview test controls"><strong>Auto Test: ON</strong><span>État : {state}</span><span>Persona : {persona}</span>{paused ? <button onClick={onResume}>Reprendre</button> : <button onClick={onPause}>Pause</button>}<button onClick={onNext} disabled={!paused}>Étape suivante</button><button onClick={onStop}>Arrêter</button></aside>;
}
function AutoTestReport({ autoTest }: { autoTest: NonNullable<CoachSession['autoTest']> }) {
  const result = autoTest.result, duration = result ? `${Math.floor(result.durationMs / 60000).toString().padStart(2, '0')}:${Math.floor(result.durationMs / 1000 % 60).toString().padStart(2, '0')}` : '—';
  return <section className={styles.autoReport}><p>AUTOMATED INTERVIEW TEST</p><h2>{result?.passed ? 'PASSED' : 'FAILED'}</h2><div><span>Durée : {duration}</span><span>Persona : {autoTest.persona}</span><span>Questions principales : {result?.mainQuestions ?? autoTest.initialQuestionCount}</span><span>Relances : {result?.followUps ?? 0}</span><span>Réponses analysées : {result?.answersAnalyzed ?? 0}</span></div>{result?.errors?.length ? <ul>{result.errors.map(error => <li key={error}>{error}</li>)}</ul> : <ul><li>✓ State machine</li><li>✓ Questions adaptatives</li><li>✓ Persistance</li><li>✓ Débrief final</li></ul>}</section>;
}
