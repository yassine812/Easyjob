'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Crosshair, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { frameToBlob } from '@/lib/api/biometric';
import { capturePosition, loadFaceGuidance, observeFace } from '@/lib/face-guidance';

export type PoseStep = 'center' | 'left' | 'right' | 'complete';
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';
export function GuidedFaceCamera({ onComplete, onCancel }: { onComplete: (center: Blob, left: Blob, right: Blob) => void; onCancel?: () => void }) {
  const { t } = useI18n(), tr = useReleaseText();
  const videoRef = useRef<HTMLVideoElement>(null), streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0), completed = useRef<Blob[]>([]), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(onComplete);
  useEffect(() => { callback.current = onComplete; }, [onComplete]);
  const [status, setStatus] = useState<CameraStatus>('idle'), [pose, setPose] = useState(0), [feedback, setFeedback] = useState('');
  const stop = useCallback(() => {
    generation.current++; clearTimeout(timer.current); streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    stop(); const run = generation.current;
    completed.current = []; setPose(0); setStatus('requesting'); setFeedback('');
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('unavailable'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (run !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera unavailable');
      video.srcObject = stream; await video.play();
      await loadFaceGuidance();
      if (run !== generation.current) return;
      setStatus('ready');
      let stable = 0;
      let origin: number | undefined;
      let capturedAt = 0;
      const scan = async () => {
        if (run !== generation.current) return;
        try {
          if (!video.videoWidth || !video.videoHeight) { timer.current = setTimeout(scan, 120); return; }
          // Detect and upload the same frozen image. Detection can take long enough
          // for the live video to move to a different pose before it completes.
          const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Camera capture unavailable');
          ctx.drawImage(video, 0, 0);
          const faces = await observeFace(canvas);
          const observed = capturePosition(faces, canvas.width, canvas.height, origin);
          if (run !== generation.current) return;
          const target = ['center', 'left', 'right'][completed.current.length];
          const poseReady = observed === target;
          setFeedback(observed === 'none' ? t.face.errorNoFace : observed === 'multiple' ? t.face.errorMultipleFaces : observed === 'position' ? prompts[completed.current.length] : '');
          stable = poseReady ? stable + 1 : 0;
          if (stable >= 3 && Date.now() - capturedAt >= 700) {
            const blob = await frameToBlob(canvas);
            if (run !== generation.current) return;
            if (!blob.size) throw new Error('Empty camera frame');
            if (origin === undefined) origin = (faces[0].detection.box.x + faces[0].detection.box.width / 2) / canvas.width;
            capturedAt = Date.now();
            completed.current.push(blob); stable = 0; setPose(completed.current.length);
            if (completed.current.length === 3) {
              const [center, left, right] = completed.current; stop(); setStatus('idle'); callback.current(center, left, right); return;
            }
          }
          timer.current = setTimeout(scan, 120);
        } catch {
          if (run === generation.current) { stop(); setStatus('error'); }
        }
      };
      void scan();
    } catch (error) {
      if (run !== generation.current) return;
      stop(); setStatus(error instanceof DOMException && error.name === 'NotAllowedError' || (error as Error)?.message?.toLowerCase().includes('permission') ? 'denied' : 'error');
    }
  };
  const active = status === 'ready' || status === 'requesting';
  const prompts = [t.face.lookCenter,
    tr('Décale légèrement la tête vers ta gauche, en gardant le nez face à l’objectif.', 'Move your head slightly to your left, keeping your nose facing the lens.', 'حرّك رأسك قليلاً إلى يسارك مع إبقاء وجهك نحو العدسة.'),
    tr('Décale légèrement la tête vers ta droite, toujours face à l’objectif.', 'Move your head slightly to your right, still facing the lens.', 'حرّك رأسك قليلاً إلى يمينك مع إبقاء وجهك نحو العدسة.')];
  return <div className="mx-auto w-full max-w-xl space-y-4 text-center">
    <div className="flex items-center justify-center gap-2"><Camera className="size-5 text-primary" /><h3 className="font-semibold">{t.face.facialSetupTitle}</h3></div>
    <p className="text-sm text-muted-foreground">{tr('Reste face à l’objectif, sans tourner la tête. Fais de petits déplacements et garde chaque position jusqu’à sa validation.', 'Keep facing the lens without turning your head. Make small sideways movements and hold each position until it is confirmed.', 'ابقَ مواجهاً للعدسة دون تدوير رأسك. تحرّك قليلاً جانبياً وثبّت كل وضعية حتى يتم تأكيدها.')}</p>
    <div className={active ? 'relative overflow-hidden rounded-2xl bg-black' : 'hidden'}>
      <video ref={videoRef} muted playsInline aria-label="Guided camera preview" className="aspect-[4/3] w-full -scale-x-100 object-contain" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-3/5 w-1/2 rounded-[50%] border-2 border-dashed border-white/80" /></div>
      {status === 'ready' && <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white"><Crosshair className="size-4 animate-pulse text-emerald-300" />{prompts[pose]}</div>}
    </div>
    {active && <><div className="flex gap-1" aria-label={tr('Progression de la capture', 'Capture progress', 'تقدم الالتقاط')}>{[0, 1, 2].map(index => <span key={index} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index < pose ? 'bg-emerald-500' : index === pose ? 'animate-pulse bg-primary' : 'bg-muted'}`} />)}</div><div className="flex justify-between gap-2 text-xs">{[t.face.stepCenter, t.face.stepLeft, t.face.stepRight].map((label, index) => <span key={index} className={`inline-flex items-center gap-1 ${index < pose ? 'text-emerald-600' : index === pose ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{index < pose ? <CheckCircle2 className="size-4" /> : index === 1 ? <ArrowLeft className="size-4 animate-pulse" /> : index === 2 ? <ArrowRight className="size-4 animate-pulse" /> : null}{label}</span>)}</div><p role="status">{status === 'requesting' ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{tr('Chargement de la caméra et des modèles…', 'Loading camera and models…', 'جارٍ تحميل الكاميرا والنماذج…')}</span> : prompts[pose]}</p>{feedback && <p aria-live="polite" className="text-sm">{feedback}</p>}</>}
    {['denied', 'unavailable', 'error'].includes(status) && <p role="alert" className="text-sm text-destructive">{status === 'denied' ? t.face.cameraDenied : status === 'unavailable' ? t.face.cameraUnavailable : tr('Détection indisponible. Vérifiez la caméra et le chargement des modèles, puis réessayez.', 'Face detection unavailable. Check your camera and model loading, then retry.', 'اكتشاف الوجه غير متاح. تحقّق من الكاميرا وتحميل النماذج ثم أعد المحاولة.')}</p>}
    <div className="flex flex-wrap justify-center gap-2">{!active && pose < 3 && <Button onClick={start}>{status === 'idle' ? t.face.cameraPermission : t.face.tryAgain}</Button>}{onCancel && <Button variant="outline" onClick={() => { stop(); onCancel(); }}>{t.face.usePasswordInstead}</Button>}</div>
  </div>;
}
