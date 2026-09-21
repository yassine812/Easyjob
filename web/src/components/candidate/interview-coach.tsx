'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { careerApi, type CoachSession } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { useI18n } from '@/lib/i18n';
import { useCoachCopy } from './interview-preparation';
import { Field, panelClass } from './career-shared';

interface SpeechEngine {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null; onend: (() => void) | null; onstart: (() => void) | null; onspeechstart: (() => void) | null; start(): void; stop(): void; abort(): void;
}
export function Practice({ initial, onComplete }: { initial: CoachSession; onComplete?: () => void }) {
  const t = useCareerText(), { locale } = useI18n(), qc = useQueryClient();
  const [session, setSession] = useState(initial), [answer, setAnswer] = useState(''), [interim, setInterim] = useState(''), [recording, setRecording] = useState(false), [seconds, setSeconds] = useState<number | undefined>(), [speechStatus, setSpeechStatus] = useState('');
  const speech = useRef<SpeechEngine | null>(null), started = useRef(0), elapsed = useRef(0), interimRef = useRef(''), measured = useRef(true);
  const c = useCoachCopy(), [voice, setVoice] = useState(true), [review, setReview] = useState(false);
  const readQuestion = () => { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); const question = session.questions[session.answers.length]; if (!question) return; const u = new SpeechSynthesisUtterance(question); u.lang = (session.locale || locale) === 'ar' ? 'ar-TN' : (session.locale || locale) === 'fr' ? 'fr-FR' : 'en-US'; window.speechSynthesis.speak(u); };
  useEffect(() => { if (!voice || review || !window.speechSynthesis) return; const question = session.questions[session.answers.length]; if (!question) return; const u = new SpeechSynthesisUtterance(question); u.lang = (session.locale || locale) === 'ar' ? 'ar-TN' : (session.locale || locale) === 'fr' ? 'fr-FR' : 'en-US'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); return () => window.speechSynthesis.cancel(); }, [session.questions, session.answers.length, session.locale, locale, voice, review]);
  useEffect(() => () => { if (speech.current) { speech.current.onend = null; speech.current.onerror = null; speech.current.onresult = null; speech.current.abort(); } window.speechSynthesis?.cancel(); }, []);
  const submit = useMutation({ mutationFn: () => careerApi.answer(session.id, { questionIndex: session.answers.length, answer, speakingSeconds: seconds }), onSuccess: s => { setSession(s); setAnswer(''); setSeconds(undefined); setReview(true); if (s.answers.length >= s.questions.length) onComplete?.(); qc.invalidateQueries({ queryKey: ['career-coach'] }); }, onError: () => toast.error(c('Réponse non enregistrée. Réessaie ; ton texte est conservé.', 'Answer not saved. Retry; your text is preserved.', 'لم تحفظ الإجابة. أعد المحاولة؛ تم الاحتفاظ بالنص.')) });
  const dictate = () => {
    if (recording) { speech.current?.stop(); return; }
    window.speechSynthesis?.cancel();
    const w = window as unknown as { SpeechRecognition?: new () => SpeechEngine; webkitSpeechRecognition?: new () => SpeechEngine };
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) { setSpeechStatus(c('Dictée indisponible dans ce navigateur. Écris ta réponse.', 'Dictation is unavailable in this browser. Type your answer.', 'الإملاء غير متاح في هذا المتصفح. اكتب إجابتك.')); return; }
    const engine = new Constructor(); speech.current = engine;
    engine.lang = (session.locale || locale) === 'ar' ? 'ar-TN' : (session.locale || locale) === 'fr' ? 'fr-FR' : 'en-US'; engine.continuous = true; engine.interimResults = true;
    engine.onresult = event => { let finalText = '', liveText = ''; for (let i = event.resultIndex; i < event.results.length; i++) { const transcript = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += transcript + ' '; else liveText += transcript; } if (finalText) setAnswer(a => `${a} ${finalText}`.trim()); interimRef.current = liveText; setInterim(liveText); };
    engine.onstart = () => { setRecording(true); setSpeechStatus(c('Micro actif : parle maintenant…', 'Microphone active: speak now…', 'الميكروفون مفعل: تحدث الآن…')); };
    engine.onspeechstart = () => setSpeechStatus(c('Je t’écoute… les mots apparaîtront ici.', 'Listening… words will appear here.', 'أستمع إليك… ستظهر الكلمات هنا.'));
    engine.onerror = event => { setRecording(false); const code = event?.error; setSpeechStatus(code === 'not-allowed' || code === 'service-not-allowed' ? c('Le navigateur a refusé la dictée. Autorise le micro pour ce site puis réessaie.', 'The browser denied dictation. Allow the microphone for this site and retry.', 'رفض المتصفح الإملاء. اسمح بالميكروفون لهذا الموقع وأعد المحاولة.') : code === 'network' ? c('Le service vocal du navigateur a besoin d’Internet. Vérifie la connexion puis réessaie.', 'The browser speech service needs Internet. Check your connection and retry.', 'تحتاج خدمة الكلام في المتصفح إلى الإنترنت. تحقق من الاتصال وأعد المحاولة.') : c('La dictée s’est arrêtée. Le texte déjà transcrit est conservé ; réessaie ou écris.', 'Dictation stopped. Already transcribed text is kept; retry or type.', 'توقف الإملاء. تم الاحتفاظ بالنص المحول؛ أعد المحاولة أو اكتب.')); };
    engine.onend = () => { setRecording(false); const pendingText = interimRef.current; if (pendingText) setAnswer(a => `${a} ${pendingText}`.trim()); interimRef.current = ''; setInterim(''); setSpeechStatus(c('Dictée terminée. Tu peux corriger le texte.', 'Dictation ended. You can edit the text.', 'انتهى الإملاء. يمكنك تعديل النص.')); elapsed.current += Math.max(1, Math.round((Date.now() - started.current) / 1000)); setSeconds(measured.current ? elapsed.current : undefined); };
    if (!answer) { elapsed.current = 0; measured.current = true; } else if (!elapsed.current || seconds === undefined) measured.current = false; setInterim('');
    started.current = Date.now(); setSeconds(undefined); interimRef.current = ''; setInterim(''); setSpeechStatus(c('Demande d’accès au service vocal…', 'Requesting the browser speech service…', 'جارٍ طلب خدمة الكلام من المتصفح…')); try { engine.start(); } catch { setRecording(false); setSpeechStatus(t('speechHelp')); }
  };
  return <section className="space-y-5"><div className={`${panelClass} space-y-4`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{session.jobTitle} · {session.answers.length}/{session.questions.length}</h2><Button variant="outline" aria-pressed={voice} onClick={() => { setVoice(!voice); window.speechSynthesis?.cancel(); }}>{voice ? c('Voix activée', 'Voice on', 'الصوت مفعل') : c('Voix désactivée', 'Voice off', 'الصوت متوقف')}</Button></div>
    <progress className="h-2 w-full accent-indigo-600" value={session.answers.length} max={session.questions.length} aria-label={c('Progression', 'Progress', 'التقدم')} />
    {review ? <div className="space-y-3"><p>{c('Ta réponse est enregistrée. Consulte les conseils ci-dessous avant de continuer.', 'Your answer is saved. Review the feedback below before continuing.', 'حُفظت إجابتك. راجع الملاحظات أدناه قبل المتابعة.')}</p><Button onClick={() => setReview(false)}>{session.answers.length < session.questions.length ? c('Question suivante', 'Next question', 'السؤال التالي') : c('Voir le bilan', 'View summary', 'عرض الملخص')}</Button></div> : session.answers.length < session.questions.length ? <>
      <p className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-300">{c('Question', 'Question', 'السؤال')} {session.answers.length + 1} / {session.questions.length}</p><h3 className="text-xl font-semibold leading-relaxed" aria-live="polite">{session.questions[session.answers.length]}</h3>
      <Button variant="outline" disabled={recording} onClick={readQuestion}>{c('Écouter la question', 'Listen to question', 'استمع إلى السؤال')}</Button>
      <Field label={t('yourAnswer')}><Textarea className="min-h-44" value={`${answer}${interim ? `${answer ? ' ' : ''}${interim}` : ''}`} disabled={submit.isPending} onChange={e => { setAnswer(e.target.value); setInterim(''); setSeconds(undefined); }} maxLength={10000} /></Field>
      <p className="text-xs leading-relaxed text-muted-foreground">{c('La dictée est facultative et peut transmettre l’audio au service vocal du navigateur. EasyJob conserve seulement le texte envoyé. Relis-le avant validation. Tu peux aussi répondre par écrit.', 'Optional dictation may send audio to your browser’s speech service. EasyJob saves only submitted text. Review it before sending. You can also type your answer.', 'الإملاء اختياري وقد يرسل الصوت إلى خدمة المتصفح الصوتية. يحفظ EasyJob النص المرسل فقط. راجعه قبل الإرسال أو أجب بالكتابة.')}</p>
      {speechStatus && <p role="status" aria-live="polite" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">{speechStatus}</p>}
      <div className="flex flex-wrap gap-3"><Button type="button" variant={recording ? 'destructive' : 'outline'} onClick={dictate} disabled={submit.isPending}>{t(recording ? 'speechStop' : 'speechStart')}</Button><Button type="button" disabled={`${answer}${interim}`.trim().length < 5 || answer.length > 10000 || submit.isPending || recording} onClick={() => submit.mutate()}>{submit.isPending ? t('PROCESSING') : t('submitAnswer')}</Button></div>
    </> : <p>{t('sessionDone')}</p>}</div>
    {[...session.answers].reverse().map((a, index) => <article className={`${panelClass} space-y-4`} key={index}><h3 className="font-semibold">{session.questions[session.answers.length - 1 - index]}</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.answer}</p><p className="text-xs text-indigo-600 dark:text-indigo-300">{t(a.feedback.method)}</p><div className="grid gap-4 sm:grid-cols-2">{[['strengths', a.feedback.good], ['suggestions', a.feedback.improve]].map(([key, values]) => <div key={String(key)}><h4 className="mb-2 text-sm font-semibold">{t(String(key))}</h4><ul className="space-y-2 text-sm">{(values as string[]).map(v => <li key={v}>{v}</li>)}</ul></div>)}</div><div><h4 className="text-sm font-semibold">{t('betterAnswer')}</h4><p className="mt-2 text-sm">{a.feedback.betterAnswer}</p></div><p className="text-sm">{t('missingKeywords')}: {a.feedback.keywords?.join(', ') || '—'}</p><p className="text-sm">{t('clarity')}: {a.feedback.clarity}</p><p className="text-sm">{t('relevanceFeedback')}: {a.feedback.relevance}</p>{a.feedback.wordsPerMinute != null && <p className="text-sm">{t('wordsPerMinute')}: {a.feedback.wordsPerMinute}</p>}</article>)}
  </section>;
}
