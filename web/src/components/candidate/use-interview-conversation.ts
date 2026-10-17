'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { careerApi, type CoachSession, type InterviewAutoTest, type InterviewState } from '@/lib/api/career';

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
export const END_OF_ANSWER_SILENCE = 6500;
export function shouldFinishAnswer(silence: number, transcript: string, coding: boolean, muted: boolean) {
  return silence >= END_OF_ANSWER_SILENCE && transcript.trim().length >= 5 && !coding && !muted;
}
export function useInterviewConversation(initial: CoachSession, stream: MediaStream | null, onComplete?: (s: CoachSession) => void, autoTest: InterviewAutoTest | undefined = initial.autoTest) {
  const [session, setSession] = useState(initial);
  const [state, setState] = useState<InterviewState>('READY');
  const [transcript, setTranscript] = useState(initial.conversation?.transcript || '');
  const [code, setCode] = useState(initial.conversation?.code || '');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [textMode, setTextMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState('');
  const [replay, setReplay] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false), [autoStep, setAutoStep] = useState(0);
  const manualAutoStep = useRef(false);
  const suspended = useRef(false);
  const speakRequested = useRef(false), resumeListening = useRef(false);
  const current = useRef({ session, transcript, code, state, muted, textMode });
  current.current = { session, transcript, code, state, muted, textMode };
  const active = useRef(false), submitting = useRef(false), recognition = useRef<Recognition | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve()), finishRef = useRef<() => void>(() => {});
  const finishResolve = useRef<(() => void) | null>(null);
  const speechStarted = useRef(0), lastVoice = useRef(0), hasSpoken = useRef(false);
  const cleanupTurn = useRef<() => void>(() => {});
  const lang = session.locale === 'ar' ? 'ar-TN' : session.locale === 'fr' ? 'fr-FR' : 'en-US';
  const fr = session.locale === 'fr', ar = session.locale === 'ar';
  const copy = useCallback((f: string, e: string, a: string) => fr ? f : ar ? a : e, [fr, ar]);
  const persist = useCallback((next: InterviewState) => {
    if (!['INTERVIEWER_SPEAKING', 'LISTENING', 'ANSWERING'].includes(next)) return queue.current;
    const c = current.current;
    const payload = { state: next, questionIndex: c.session.answers.length, transcript: c.transcript, code: c.code };
    queue.current = queue.current.catch(() => {}).then(() => careerApi.saveTurn(c.session.id, payload));
    return queue.current;
  }, []);
  const transition = useCallback((next: InterviewState) => {
    if (!active.current) return;
    current.current.state = next; setState(next);
    void persist(next).catch(() => setNotice(copy('Synchronisation en attente…', 'Waiting to sync…', 'بانتظار المزامنة…')));
  }, [persist, copy]);

  const finish = useCallback(async () => {
    if (submitting.current || !active.current || suspended.current) return;
    submitting.current = true;
    hasSpoken.current = false;
    // Stop recognition first so the final result event is included in the submitted transcript.
    if (recognition.current) {
      await new Promise<void>(resolve => {
        const timeout = window.setTimeout(resolve, 1000);
        finishResolve.current = () => { clearTimeout(timeout); resolve(); };
        try { recognition.current?.stop(); } catch { finishResolve.current?.(); }
      });
    }
    if (!active.current) { submitting.current = false; return; }
    const c = current.current;
    if (autoTest) {
      transition('ANALYZING'); setError('');
      try {
        const next = await careerApi.autoTestAnswer(c.session.id);
        if (!active.current) return;
        current.current.session = next; transition('INTERVIEWER_FEEDBACK');
        const last = next.answers[next.answers.length - 1];
        setNotice(last.analysis?.missing_points[0] || last.analysis?.strengths[0] || copy('Réponse simulée analysée', 'Simulated answer analysed', 'تم تحليل الإجابة المحاكية'));
        window.setTimeout(() => {
          if (!active.current) return;
          submitting.current = false; setTranscript(''); setCode(''); setNotice(''); current.current.transcript = ''; current.current.code = '';
          if (next.answers.length >= next.questions.length) {
            void careerApi.completeAutoTest(next.id).then(final => { if (!active.current) return; current.current.session = final; setSession(final); transition('COMPLETED'); onComplete?.(final); }).catch(() => { submitting.current = false; transition('INTERVIEWER_FEEDBACK'); setError(copy('Le bilan de test n’a pas pu être finalisé.', 'The test report could not be finalised.', 'تعذر إنهاء تقرير الاختبار.')); });
          } else setSession(next);
        }, Math.max(450, Math.round(2500 / autoTest.speed)));
      } catch {
        if (!active.current) return;
        submitting.current = false; transition('ANSWERING'); setError(copy('Le test automatisé a été interrompu. Réessaie ou arrête le test.', 'The automated test was interrupted. Retry or stop it.', 'توقف الاختبار التلقائي. أعد المحاولة أو أوقف الاختبار.'));
      }
      return;
    }
    const pending = c.session.conversation?.state === 'ANALYZING' ? c.session.conversation.pendingAnswer : undefined;
    const answer = pending?.answer || (c.session.interviewType === 'CODING' ? `${c.code}\n\n${c.transcript}`.trim() : c.transcript.trim());
    if (answer.length < 5 || answer.length > 10000 || (c.session.interviewType === 'CODING' && !c.code.trim() && !pending)) {
      submitting.current = false;
      setError(copy('Ajoute ta réponse avant de terminer.', 'Add your answer before finishing.', 'أضف إجابتك قبل الانتهاء.')); return;
    }
    transition('ANALYZING'); setError('');
    try {
      await persist('ANSWERING').catch(() => {});
      const next = await careerApi.answer(c.session.id, pending || { questionIndex: c.session.answers.length, answer, transcript: c.transcript, code: c.code,
        speakingSeconds: !c.textMode && c.session.interviewType !== 'CODING' && speechStarted.current ? Math.min(3600, Math.max(1, Math.round((Date.now() - speechStarted.current) / 1000))) : undefined });
      if (!active.current) return;
      current.current.session = next;
      transition('INTERVIEWER_FEEDBACK');
      const last = next.answers[next.answers.length - 1];
      setNotice(last.analysis?.missing_points[0] || last.analysis?.strengths[0] || copy('Réponse prise en compte', 'Answer recorded', 'تم تسجيل الإجابة'));
      window.setTimeout(() => {
        if (!active.current) return;
        submitting.current = false; setTranscript(''); setCode(''); setNotice('');
        current.current.transcript = ''; current.current.code = '';
        setSession(next);
        if (next.answers.length >= next.questions.length) { transition('COMPLETED'); onComplete?.(next); }
      }, 2500);
    } catch {
      if (!active.current) return;
      submitting.current = false; transition('ANSWERING');
      setError(copy('Analyse interrompue. Ta réponse est conservée. Réessaie.', 'Analysis interrupted. Your answer is preserved. Retry.', 'توقف التحليل. تم الاحتفاظ بإجابتك. أعد المحاولة.'));
    }
  }, [autoTest, copy, onComplete, persist, transition]);
  finishRef.current = () => { void finish(); };

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; cleanupTurn.current(); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => {
    if (!['LISTENING', 'ANSWERING'].includes(state)) return;
    const timer = setTimeout(() => { void persist(state).then(() => { if (active.current) setNotice(''); }).catch(() => { if (active.current) setNotice(copy('Synchronisation en attente…', 'Waiting to sync…', 'بانتظار المزامنة…')); }); }, 600);
    return () => clearTimeout(timer);
  }, [transcript, code, state, persist, copy]);

  useEffect(() => {
    if (session.answers.length >= session.questions.length) { setState('COMPLETED'); return; }
    if (suspended.current) return;
    let cancelled = false, restart: ReturnType<typeof setTimeout> | undefined;
    let finalText = current.current.transcript;
    let stopListening = false;
    speechStarted.current = 0; hasSpoken.current = false; lastVoice.current = 0;
    const stop = () => { stopListening = true; clearTimeout(restart); if (recognition.current) { recognition.current.onend = null; recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.abort(); recognition.current = null; } };
    cleanupTurn.current = stop;
    const listen = () => {
      if (cancelled || stopListening || suspended.current) return;
      setCaption(session.questions[session.answers.length]); transition(finalText ? 'ANSWERING' : 'LISTENING');
      if (current.current.muted || current.current.textMode) return;
      const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
      const Engine = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!Engine) { setTextMode(true); setError(copy('La dictée est indisponible ici. Tu peux écrire ta réponse.', 'Dictation is unavailable here. You can type your answer.', 'الإملاء غير متاح هنا. يمكنك كتابة إجابتك.')); return; }
      const engine = new Engine(); recognition.current = engine;
      engine.lang = lang; engine.continuous = true; engine.interimResults = true;
      engine.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalText = `${finalText} ${e.results[i][0].transcript}`.trim(); else interim += e.results[i][0].transcript; }
        const value = `${finalText} ${interim}`.trim().slice(0, 10000);
        current.current.transcript = value; setTranscript(value);
        if (!speechStarted.current) speechStarted.current = Date.now();
        hasSpoken.current = true; lastVoice.current = Date.now();
        if (!submitting.current && current.current.state !== 'ANSWERING') transition('ANSWERING');
      };
      engine.onerror = e => {
        if (cancelled || e.error === 'aborted' || e.error === 'no-speech') return;
        stopListening = true; setTextMode(true);
        setError(copy('La dictée s’est interrompue. Ton texte est conservé ; tu peux le compléter ou réactiver le micro.', 'Dictation stopped. Your text is preserved; complete it or reactivate the microphone.', 'توقف الإملاء. احتفظنا بالنص؛ أكمله أو أعد تفعيل الميكروفون.'));
      };
      engine.onend = () => {
        recognition.current = null; finishResolve.current?.(); finishResolve.current = null;
        finalText = current.current.transcript;
        if (!cancelled && !stopListening && !submitting.current && !current.current.muted && !current.current.textMode) restart = setTimeout(listen, 250);
      };
      try { engine.start(); } catch { setTextMode(true); setError(copy('Micro indisponible. Tu peux écrire ta réponse.', 'Microphone unavailable. You can type your answer.', 'الميكروفون غير متاح. يمكنك كتابة إجابتك.')); }
    };
    if (autoTest) { transition('INTERVIEWER_SPEAKING'); setCaption(session.questions[session.answers.length]); }
    else if (session.conversation?.state === 'ANALYZING' && session.conversation.pendingAnswer) { finishRef.current(); }
    else if (!speakRequested.current && (resumeListening.current || current.current.transcript || current.current.code)) { resumeListening.current = false; listen(); }
    else {
      speakRequested.current = false;
      transition('INTERVIEWER_SPEAKING'); setCaption('');
      const question = session.questions[session.answers.length];
      if (!window.speechSynthesis) { setCaption(question); listen(); }
      else {
        const utterance = new SpeechSynthesisUtterance(question); utterance.lang = lang; utterance.rate = 0.96;
        utterance.onboundary = e => { if (!cancelled) { const end = question.indexOf(' ', e.charIndex + Math.max(1, e.charLength)); setCaption(question.slice(0, end < 0 ? question.length : end)); } };
        utterance.onstart = () => { if (!cancelled) setCaption(question.split(' ').slice(0, 3).join(' ')); };
        utterance.onend = listen;
        utterance.onerror = e => { if (!cancelled && e.error !== 'interrupted' && e.error !== 'canceled') { setNotice(copy('Lecture vocale indisponible. La question reste affichée.', 'Voice playback unavailable. The question remains visible.', 'القراءة الصوتية غير متاحة. يبقى السؤال ظاهراً.')); listen(); } };
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
      }
    }
    return () => { cancelled = true; stop(); window.speechSynthesis?.cancel(); };
  }, [session.id, session.answers.length, replay, lang, copy, transition, autoTest]); // A turn starts once; transcript edits must not replay the question.

  const autoAdvance = useCallback(() => {
    if (!autoTest || (autoPaused && !manualAutoStep.current) || submitting.current || !active.current) return;
    manualAutoStep.current = false;
    if (state === 'INTERVIEWER_SPEAKING') { transition('LISTENING'); return; }
    if (state === 'LISTENING') { transition('ANSWERING'); return; }
    if (state === 'ANSWERING') finishRef.current();
  }, [autoTest, autoPaused, state, transition]);
  useEffect(() => {
    if (!autoTest || (autoPaused && !manualAutoStep.current) || ['ANALYZING', 'INTERVIEWER_FEEDBACK', 'COMPLETED'].includes(state)) return;
    const question = session.questions[session.answers.length] || '';
    const base = state === 'INTERVIEWER_SPEAKING' ? Math.max(1200, question.length * 35) : state === 'LISTENING' ? 600 : 800;
    const timer = window.setTimeout(autoAdvance, manualAutoStep.current ? 0 : Math.max(120, Math.round(base / autoTest.speed)));
    return () => clearTimeout(timer);
  }, [autoAdvance, autoPaused, autoStep, autoTest, session.answers.length, session.questions, state]);

  useEffect(() => {
    if (!stream?.getAudioTracks().length || typeof AudioContext === 'undefined' || session.answers.length >= session.questions.length) return;
    const context = new AudioContext(), analyser = context.createAnalyser(); analyser.fftSize = 512;
    const source = context.createMediaStreamSource(stream); source.connect(analyser);
    void context.resume().catch(() => {});
    const data = new Float32Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
      const c = current.current, listening = ['LISTENING', 'ANSWERING'].includes(c.state) && !c.muted && !c.textMode;
      setLevel(listening ? Math.min(1, rms * 10) : 0);
      if (!listening || submitting.current || suspended.current) return;
      if (rms > 0.015) { lastVoice.current = Date.now(); hasSpoken.current = true; }
      if (hasSpoken.current && shouldFinishAnswer(Date.now() - lastVoice.current, c.transcript, c.session.interviewType === 'CODING', c.muted)) finishRef.current();
    }, 100);
    return () => { clearInterval(timer); source.disconnect(); void context.close(); };
  }, [stream, session.answers.length >= session.questions.length]);
  const updateTranscript = (value: string) => { current.current.transcript = value; setTranscript(value); };
  const updateCode = (value: string) => { current.current.code = value; setCode(value); };
  const toggleMic = () => {
    const next = !muted; current.current.muted = next; setMuted(next);
    stream?.getAudioTracks().forEach(t => { t.enabled = !next; });
    if (next) { cleanupTurn.current(); } else { current.current.textMode = false; setTextMode(false); setError(''); resumeListening.current = true; setReplay(n => n + 1); }
  };
  const enableText = () => { current.current.textMode = true; setTextMode(true); cleanupTurn.current(); };
  const checkpoint = async () => { cleanupTurn.current(); window.speechSynthesis?.cancel(); await persist(current.current.state).catch(() => {}); };
  const suspend = (value: boolean) => { suspended.current = value; if (value) { cleanupTurn.current(); window.speechSynthesis?.cancel(); } else { resumeListening.current = current.current.state !== 'INTERVIEWER_SPEAKING'; setReplay(n => n + 1); } };
  const stopAutoTest = async () => { setAutoPaused(true); await checkpoint(); if (autoTest) { const stopped = await careerApi.stopAutoTest(current.current.session.id); current.current.session = stopped; setSession(stopped); } };
  return { session, state, transcript, code, caption, error, notice, textMode, muted, level, copy, updateTranscript, updateCode, toggleMic, enableText, checkpoint, suspend, autoTest, autoPaused, setAutoPaused, nextAutoStep: () => { manualAutoStep.current = true; setAutoStep(value => value + 1); }, stopAutoTest, finish: () => finishRef.current(), replay: () => { setError(''); speakRequested.current = true; setReplay(n => n + 1); } };
}
