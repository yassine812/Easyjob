'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { panelClass } from './career-shared';
import { facePose, observeFace } from '@/lib/face-guidance';

export function useCoachCopy() {
  const { locale } = useI18n();
  return (fr: string, en: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
}
export function PreparationAdvice() {
  const c = useCoachCopy();
  const tips = [
    [c('Regard & cadrage', 'Eye line & framing', 'النظر والإطار'), c('Place la caméra à hauteur des yeux : visage et haut du buste visibles. Regarde l’objectif en répondant ; tu peux consulter tes notes naturellement.', 'Place the camera at eye level with your face and upper body visible. Look towards the lens when answering; natural glances at notes are fine.', 'ضع الكاميرا في مستوى العينين مع ظهور الوجه وأعلى الجسم. انظر نحو العدسة عند الإجابة ويمكنك مراجعة ملاحظاتك بشكل طبيعي.')],
    [c('Posture & gestes', 'Posture & gestures', 'الوضعية والحركات'), c('Assieds-toi confortablement, dos soutenu, épaules détendues. Si tu préfères rester debout, garde un appui stable. Choisis une position adaptée à tes besoins et évite de te balancer.', 'Sit comfortably, back supported and shoulders relaxed. If standing, use a stable stance. Choose a position that suits your needs and avoid rocking.', 'اجلس براحة مع دعم الظهر وإرخاء الكتفين. إن فضلت الوقوف فاختر وضعية ثابتة تناسب احتياجاتك وتجنب التأرجح.')],
    [c('Tenue & environnement', 'Clothing & surroundings', 'الملابس والمحيط'), c('Choisis une tenue propre et confortable, adaptée au poste et aux usages de l’entreprise. Éclaire ton visage de face, simplifie l’arrière-plan et coupe les notifications.', 'Choose clean, comfortable clothing suited to the role and company. Light your face from the front, simplify the background and silence notifications.', 'اختر ملابس نظيفة ومريحة تناسب الوظيفة والشركة. ضع الإضاءة أمامك وبسط الخلفية وأوقف الإشعارات.')],
    [c('Voix & réponse', 'Voice & answer', 'الصوت والإجابة'), c('Parle distinctement, avec une courte pause avant de répondre. Prépare un exemple en 1 à 2 minutes : situation, tâche, action, résultat. Demande une précision si nécessaire.', 'Speak clearly and pause briefly before answering. Prepare a 1–2 minute example: situation, task, action, result. Ask for clarification when needed.', 'تحدث بوضوح وتوقف قليلاً قبل الإجابة. حضر مثالاً في دقيقة إلى دقيقتين: الموقف والمهمة والإجراء والنتيجة. اطلب توضيحاً عند الحاجة.')],
  ];
  return <section className={`${panelClass} space-y-4`}><h3 className="font-semibold">{c('Avant la première question', 'Before your first question', 'قبل السؤال الأول')}</h3>{tips.map(([title, text], i) => <div className="flex gap-3" key={title}><span className="text-sm font-semibold text-indigo-500">0{i + 1}</span><div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div></div>)}</section>;
}

export function MediaPreparation({ finished = false }: { finished?: boolean }) {
  const c = useCoachCopy(), video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null), frame = useRef(0), generation = useRef(0);
  const [active, setActive] = useState(false), [hasVideo, setHasVideo] = useState(false), [pending, setPending] = useState(false), [level, setLevel] = useState(0), [error, setError] = useState(''), [poseHint, setPoseHint] = useState('');
  const release = () => { generation.current++; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; void audio.current?.close().catch(() => {}); audio.current = null; if (video.current) video.current.srcObject = null; };
  useEffect(() => () => { generation.current++; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); void audio.current?.close().catch(() => {}); }, []);
  useEffect(() => {
    if (!active || !hasVideo || !video.current) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const scan = async () => {
      const element = video.current;
      if (!element || cancelled || !element.videoWidth) { timer = setTimeout(scan, 700); return; }
      try {
        const pose = facePose(await observeFace(element), element.videoWidth, element.videoHeight);
        if (!cancelled) setPoseHint(pose === 'center' ? c('Bon cadrage : regarde vers l’objectif.', 'Good framing: look towards the lens.', 'إطار جيد: انظر نحو العدسة.') : pose === 'none' ? c('Visage non détecté : rapproche-toi légèrement et vérifie la lumière.', 'Face not detected: move a little closer and check the lighting.', 'لم يتم اكتشاف الوجه: اقترب قليلاً وتحقق من الإضاءة.') : pose === 'multiple' ? c('Une seule personne doit être visible pour cet entraînement.', 'Only one person should be visible for this practice.', 'يجب أن يظهر شخص واحد فقط في هذا التدريب.') : pose === 'left' || pose === 'right' ? c('Tu regardes ailleurs : reviens doucement vers l’objectif.', 'You are looking away: gently return your gaze towards the lens.', 'تنظر بعيداً: عد بنظرك بلطف نحو العدسة.') : c('Recentre ton visage dans le cadre et regarde vers l’objectif.', 'Center your face in the frame and look towards the lens.', 'وسّط وجهك في الإطار وانظر نحو العدسة.'));
      } catch {
        if (!cancelled) setPoseHint(c('Repère de regard indisponible ; les conseils restent disponibles.', 'Gaze guidance unavailable; preparation tips remain available.', 'إرشاد النظر غير متاح؛ تبقى نصائح التحضير متوفرة.'));
      }
      if (!cancelled) timer = setTimeout(scan, 900);
    };
    void scan();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [active, hasVideo, c]);
  const stop = () => { release(); setActive(false); setHasVideo(false); setPending(false); setLevel(0); setPoseHint(''); };
  // The parent unmounts this component when the interview ends.
  const request = async (withCamera: boolean) => {
    release(); setError(''); setPending(true); setActive(false); setHasVideo(false);
    const attempt = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Unavailable', 'NotSupportedError');
      const acquired = await navigator.mediaDevices.getUserMedia({ video: withCamera ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false, audio: { echoCancellation: true, noiseSuppression: true } });
      if (attempt !== generation.current) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream.current = acquired; setActive(true); setHasVideo(withCamera); setPoseHint(withCamera ? c('Chargement du repère de regard…', 'Loading gaze guidance…', 'جارٍ تحميل إرشاد النظر…') : '');
      acquired.getTracks().forEach(track => { track.onended = () => { stop(); setError(c('Appareil déconnecté. Réactive-le pour continuer.', 'Device disconnected. Enable it again to continue.', 'تم فصل الجهاز. أعد تفعيله للمتابعة.')); }; });
      if (video.current && withCamera) { video.current.srcObject = acquired; void video.current.play().catch(() => {}); }
      try {
        const context = new AudioContext(); audio.current = context; await context.resume();
        if (attempt !== generation.current) { void context.close().catch(() => {}); return; }
        const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(acquired).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const tick = () => { analyser.getByteTimeDomainData(samples); const rms = Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length); setLevel(Math.min(100, Math.round(rms * 450))); frame.current = requestAnimationFrame(tick); }; tick();
      } catch { /* The preview remains available without a level meter. */ }
    } catch (e) {
      if (attempt !== generation.current) return;
      release(); setActive(false); setHasVideo(false);
      const name = e instanceof DOMException ? e.name : '';
      setError(name === 'NotAllowedError' ? c('Autorisation refusée. Autorise caméra/micro dans les réglages du site puis réessaie, ou continue par écrit.', 'Permission denied. Allow camera/microphone in site settings and retry, or continue by typing.', 'رُفض الإذن. اسمح بالكاميرا والميكروفون في إعدادات الموقع أو تابع بالكتابة.') : name === 'NotFoundError' ? c('Caméra ou micro introuvable. Essaie le micro seul ou continue par écrit.', 'Camera or microphone not found. Try microphone only or continue by typing.', 'لم يتم العثور على الكاميرا أو الميكروفون. جرب الميكروفون فقط أو تابع بالكتابة.') : name === 'NotReadableError' ? c('Appareil utilisé par une autre application. Ferme-la puis réessaie.', 'Device busy in another application. Close it and retry.', 'الجهاز مستخدم في تطبيق آخر. أغلقه وأعد المحاولة.') : c('Appareils indisponibles. Vérifie HTTPS/localhost et les réglages du navigateur. Le mode écrit reste disponible.', 'Devices unavailable. Check HTTPS/localhost and browser settings. Typing remains available.', 'الأجهزة غير متاحة. تحقق من HTTPS/localhost وإعدادات المتصفح. يمكنك المتابعة بالكتابة.'));
      setPending(false);
    } finally { if (attempt === generation.current) setPending(false); }
  };
  return <section className={`${panelClass} h-fit space-y-4`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{c('Ton espace de préparation', 'Your preparation space', 'مساحة التحضير')}</h3><span className={`rounded-full px-2 py-1 text-xs ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{active ? c('Appareils actifs', 'Devices on', 'الأجهزة مفعلة') : c('Appareils éteints', 'Devices off', 'الأجهزة متوقفة')}</span></div>
    <div className="relative overflow-hidden rounded-xl bg-slate-950 text-slate-200"><video ref={video} autoPlay muted playsInline aria-label={c('Aperçu caméra privé', 'Private camera preview', 'معاينة خاصة')} className={`aspect-video w-full -scale-x-100 object-cover ${hasVideo ? '' : 'hidden'}`} />{!hasVideo && <div className="flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center"><Camera className="size-9 text-indigo-300" /><p className="text-sm">{c('Caméra à hauteur des yeux', 'Camera at eye level', 'الكاميرا في مستوى العينين')}</p></div>}{hasVideo && <div aria-hidden className="pointer-events-none absolute inset-x-[27%] bottom-[12%] top-[12%] rounded-[45%] border-2 border-dashed border-white/50" />}</div>
    {hasVideo && <p role="status" aria-live="polite" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">{poseHint}</p>}
    {active && <div><div className="mb-2 flex items-center gap-2 text-xs"><Mic className="size-4" />{c('Parle pour vérifier le niveau du micro', 'Speak to check the microphone level', 'تحدث للتحقق من مستوى الميكروفون')}</div><meter min={0} max={100} value={level} aria-label={c('Niveau du micro', 'Microphone level', 'مستوى الميكروفون')} className="h-3 w-full" /></div>}
    <p className="text-sm leading-relaxed text-muted-foreground">{c('Autorises-tu la caméra et le micro pour cet entraînement ? Le navigateur demandera ton accord au clic. La vidéo reste sur ton appareil et n’est pas enregistrée.', 'Allow camera and microphone for this practice? Your browser asks when you click. Video stays on your device and is not recorded.', 'هل تسمح بالكاميرا والميكروفون للتدريب؟ سيطلب المتصفح الإذن عند النقر. يبقى الفيديو على جهازك ولا يُسجل.')}</p>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>}
    <div className="flex flex-wrap gap-2">{active ? <Button variant="outline" onClick={stop}>{c('Couper caméra et micro', 'Turn devices off', 'إيقاف الأجهزة')}</Button> : <><Button disabled={pending || finished} onClick={() => void request(true)}>{pending ? c('Autorisation en attente…', 'Waiting for permission…', 'في انتظار الإذن…') : c('Autoriser caméra et micro', 'Allow camera & microphone', 'السماح بالكاميرا والميكروفون')}</Button><Button variant="outline" disabled={pending || finished} onClick={() => void request(false)}>{c('Micro uniquement', 'Microphone only', 'الميكروفون فقط')}</Button></>}{pending && <Button variant="outline" onClick={stop}>{c('Annuler', 'Cancel', 'إلغاء')}</Button>}</div>
    <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />{c('Caméra facultative. Les conseils de posture et de tenue sont des repères, pas une évaluation de ton apparence. Tu peux commencer sans appareils.', 'Camera optional. Posture and clothing tips are guidance, not an appearance assessment. You can start without devices.', 'الكاميرا اختيارية. إرشادات الوضعية والملابس ليست تقييماً لمظهرك. يمكنك البدء دون أجهزة.')}</p>
  </section>;
}
