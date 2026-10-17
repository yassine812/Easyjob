'use client';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Crosshair, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { frameToBlob } from '@/lib/api/biometric';
import { capturePosition, loadFaceGuidance, observeFace, type FaceObservation } from '@/lib/face-guidance';
import { faceImageSharpness } from '@/lib/face-image-quality';

export type PoseStep = 'center' | 'left' | 'right' | 'complete';
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';
export type FaceScanMode = 'multi_pose' | 'frontal';

interface GuidedFaceCameraProps {
  onComplete: (center: Blob, second: Blob, third: Blob) => void;
  onCancel?: () => void;
  autoStart?: boolean;
  scanMode?: FaceScanMode;
}

/**
 * The browser detector can find a face in a wide webcam frame that the server
 * detector cannot reliably resolve after JPEG compression. Keep a generous
 * margin for liveness, then upscale the face region before uploading it.
 */
interface FaceCropRegion { left: number; top: number; width: number; height: number }

function faceCropRegion(canvas: HTMLCanvasElement, face: FaceObservation): FaceCropRegion {
  const { x, y, width, height } = face.detection.box;
  const marginX = width * 0.45;
  const marginY = height * 0.5;
  const left = Math.max(0, x - marginX);
  const top = Math.max(0, y - marginY);
  const right = Math.min(canvas.width, x + width + marginX);
  const bottom = Math.min(canvas.height, y + height + marginY);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function cropFaceForUpload(canvas: HTMLCanvasElement, region: FaceCropRegion): HTMLCanvasElement {
  // Keep the original snapshot when a detector returns an incomplete box.
  // This can happen during model warm-up and avoids producing a 0x0 canvas.
  if (![region.left, region.top, region.width, region.height].every(Number.isFinite)
    || region.width <= 0 || region.height <= 0 || canvas.width <= 0 || canvas.height <= 0) {
    return canvas;
  }
  const sourceWidth = Math.min(region.width, canvas.width - region.left);
  const sourceHeight = Math.min(region.height, canvas.height - region.top);
  if (sourceWidth <= 0 || sourceHeight <= 0) return canvas;
  const scale = Math.min(768 / sourceWidth, 768 / sourceHeight);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(sourceWidth * scale));
  output.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = output.getContext('2d');
  if (!context) return canvas;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, region.left, region.top, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
  return output;
}

async function configureCameraFocus(stream: MediaStream) {
  const track = stream.getVideoTracks?.()[0];
  if (!track?.getCapabilities || !track.applyConstraints) return;
  // Image Capture controls are optional and not yet included in lib.dom.
  // Unsupported controls must never prevent a camera from opening.
  try {
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[]; exposureMode?: string[]; whiteBalanceMode?: string[];
    };
    const base = track.getConstraints?.() ?? {};
    let automatic: Record<string, string> = {};
    for (const control of ['focusMode', 'exposureMode', 'whiteBalanceMode'] as const) {
      if (!capabilities[control]?.includes('continuous')) continue;
      try {
        const requested = { ...automatic, [control]: 'continuous' };
        await track.applyConstraints({ ...base, advanced: [...(base.advanced ?? []), requested as MediaTrackConstraintSet] });
        automatic = requested;
      } catch { /* Continue using the camera's own settings if a driver refuses. */ }
    }
  } catch { /* Some browsers expose getCapabilities but cannot query this camera. */ }
}

export function GuidedFaceCamera({ onComplete, onCancel, autoStart = false, scanMode = 'multi_pose' }: GuidedFaceCameraProps) {
  const { t } = useI18n();
  const tr = useReleaseText();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const completed = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(onComplete);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [pose, setPose] = useState(0);
  const [feedback, setFeedback] = useState('');
  const prompts = useMemo(() => [
    t.face.lookCenter,
    tr('Décale légèrement la tête vers ta gauche, en gardant le nez face à l’objectif.', 'Move your head slightly to your left, keeping your nose facing the lens.', 'حرّك رأسك قليلاً إلى يسارك مع إبقاء وجهك نحو العدسة.'),
    tr('Décale légèrement la tête vers ta droite, toujours face à l’objectif.', 'Move your head slightly to your right, still facing the lens.', 'حرّك رأسك قليلاً إلى يمينك مع إبقاء وجهك نحو العدسة.'),
  ], [t, tr]);
  const currentPrompt = scanMode === 'frontal'
    ? tr('Regardez la caméra et gardez le visage dans le cadre.', 'Look at the camera and keep your face inside the frame.', 'انظر إلى الكاميرا وحافظ على وجهك داخل الإطار.')
    : prompts[pose];

  useEffect(() => { callback.current = onComplete; }, [onComplete]);

  const stop = useCallback(() => {
    generation.current += 1;
    clearTimeout(timer.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    stop();
    const run = generation.current;
    completed.current = [];
    setPose(0);
    setStatus('requesting');
    setFeedback('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (run !== generation.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera unavailable');
      video.srcObject = stream;
      await video.play();
      await configureCameraFocus(stream);
      const cameraReadyAt = Date.now();
      await loadFaceGuidance();
      if (run !== generation.current) return;
      setStatus('ready');
      let stable = 0;
      let origin: number | undefined;
      let capturedAt = 0;
      let captureWindowAt = 0;
      let bestFrame: { canvas: HTMLCanvasElement; face: FaceObservation; score: number; origin: number } | undefined;
      let uploadRegion: FaceCropRegion | undefined;
      let missedFrames = 0;
      const scan = async () => {
        if (run !== generation.current) return;
        try {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
            timer.current = setTimeout(scan, 120);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Camera capture unavailable');
          ctx.drawImage(video, 0, 0);
          const faces = await observeFace(canvas);
          const observed = capturePosition(faces, canvas.width, canvas.height, origin);
          if (run !== generation.current) return;
          if (observed === 'none') missedFrames += 1;
          else missedFrames = 0;
          const target = scanMode === 'frontal' ? 'center' : ['center', 'left', 'right'][completed.current.length];
          const poseReady = observed === target;
          if (scanMode === 'frontal' && poseReady && Date.now() - cameraReadyAt < 1500) {
            stable = 0;
            setFeedback(tr('Mise au point… Garde ton visage bien éclairé et attends une image nette.', 'Focusing… Keep your face well lit and wait for a sharp image.', 'جارٍ ضبط التركيز… حافظ على إضاءة وجهك وانتظر صورة واضحة.'));
            timer.current = setTimeout(scan, 160);
            return;
          }
          const sharpness = scanMode === 'frontal' && poseReady ? faceImageSharpness(canvas, faces[0]) : 0;
          const softImage = scanMode === 'frontal' && poseReady && sharpness < 80;
          setFeedback(
            observed === 'none' && missedFrames >= 3
              ? t.face.errorNoFace
              : observed === 'none' ? ''
              : observed === 'multiple'
                ? t.face.errorMultipleFaces
                : observed === 'position' ? currentPrompt
                  : softImage ? tr('Image peu nette : la comparaison sera quand même tentée.', 'The image is soft: comparison will still be attempted.', 'الصورة غير واضحة تماماً: ستتم محاولة المقارنة رغم ذلك.') : '',
          );
          stable = poseReady ? stable + 1 : 0;
          if (!poseReady) {
            captureWindowAt = 0;
            bestFrame = undefined;
          } else if (scanMode === 'frontal') {
            if (!captureWindowAt) captureWindowAt = Date.now();
            if (!bestFrame || sharpness > bestFrame.score) {
              bestFrame = { canvas, face: faces[0], score: sharpness, origin: (faces[0].detection.box.x + faces[0].detection.box.width / 2) / canvas.width };
            }
          }
          // Pick the sharpest actual frame from each separate short window.
          // There is no sharpness cutoff: soft cameras still reach comparison.
          const windowReady = scanMode !== 'frontal' || Date.now() - captureWindowAt >= 750;
          if (stable >= 3 && windowReady && Date.now() - capturedAt >= 700) {
            const uploadCanvas = scanMode === 'frontal' && bestFrame
              ? cropFaceForUpload(bestFrame.canvas, uploadRegion ?? (uploadRegion = faceCropRegion(bestFrame.canvas, bestFrame.face)))
              : canvas;
            const blob = await frameToBlob(uploadCanvas);
            if (run !== generation.current) return;
            if (!blob.size) throw new Error('Empty camera frame');
            if (origin === undefined) origin = bestFrame?.origin ?? (faces[0].detection.box.x + faces[0].detection.box.width / 2) / canvas.width;
            capturedAt = Date.now();
            completed.current.push(blob);
            stable = 0;
            captureWindowAt = 0;
            bestFrame = undefined;
            setPose(completed.current.length);
            const requiredFrames = scanMode === 'frontal' ? 2 : 3;
            if (completed.current.length === requiredFrames) {
              const [center, second, third] = completed.current;
              stop();
              setStatus('idle');
              callback.current(center, second, third ?? second);
              return;
            }
          }
          timer.current = setTimeout(scan, 120);
        } catch {
          if (run === generation.current) {
            stop();
            setStatus('error');
          }
        }
      };
      void scan();
    } catch (error) {
      if (run !== generation.current) return;
      stop();
      setStatus(
        error instanceof DOMException && error.name === 'NotAllowedError'
          || (error as Error)?.message?.toLowerCase().includes('permission')
          ? 'denied'
          : 'error',
      );
    }
  }, [currentPrompt, scanMode, stop, t, tr]);

  const startRef = useRef(start);
  useEffect(() => { startRef.current = start; }, [start]);
  useEffect(() => {
    if (!autoStart) return;
    // Strict Mode cleans up and replays effects. Cancel the first scheduled
    // start so its stopped stream cannot leave the preview loading forever.
    const pending = setTimeout(() => { void startRef.current(); }, 0);
    return () => { clearTimeout(pending); stop(); };
  }, [autoStart, stop]);

  const active = status === 'ready' || status === 'requesting';
  const requiredFrames = scanMode === 'frontal' ? 2 : 3;
  if (scanMode === 'frontal') {
    const failed = ['denied', 'unavailable', 'error'].includes(status);
    const statusText = status === 'requesting' || status === 'idle'
      ? tr('Ouverture de la caméra…', 'Opening camera…', 'جارٍ فتح الكاميرا…')
      : tr('Comparaison du visage…', 'Comparing your face…', 'جارٍ مقارنة وجهك…');
    return <div className="mx-auto w-full max-w-[360px] space-y-3 text-center" data-testid="face-login-scan">
      <p className="text-sm text-muted-foreground">{tr('Regarde la caméra. Ton visage sera comparé à ta référence enregistrée.', 'Look at the camera. Your face will be compared with your saved reference.', 'انظر إلى الكاميرا. ستتم مقارنة وجهك بمرجعك المحفوظ.')}</p>
      <div className="relative overflow-hidden rounded-2xl bg-slate-950" style={{ height: 'min(30dvh, 240px)' }}>
        <video ref={videoRef} muted playsInline aria-label="Face login camera preview" className="h-full w-full -scale-x-100 object-contain" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-[72%] aspect-[3/4] rounded-[45%] border-2 border-white/80" /></div>
        {!failed && <div role="status" className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-lg bg-slate-950/85 px-3 py-2 text-xs text-white"><Loader2 className="size-3.5 shrink-0 animate-spin" />{statusText}</div>}
      </div>
      {failed ? <p role="alert" className="text-sm text-destructive">{status === 'denied' ? t.face.cameraDenied : status === 'unavailable' ? t.face.cameraUnavailable : tr('Impossible de démarrer le scan. Vérifie la caméra et réessaie.', 'Could not start the scan. Check the camera and try again.', 'تعذر بدء المسح. تحقّق من الكاميرا وأعد المحاولة.')}</p>
        : <p aria-live="polite" className="text-xs text-muted-foreground">{feedback || tr('Garde le visage de face, dans le cadre et bien éclairé.', 'Keep your face forward, inside the frame and well lit.', 'أبقِ وجهك مواجهاً للكاميرا داخل الإطار وفي إضاءة جيدة.')}</p>}
      <div className="flex flex-wrap justify-center gap-2">{failed && <Button size="sm" onClick={start}>{t.face.tryAgain}</Button>}{onCancel && <Button size="sm" variant="ghost" onClick={() => { stop(); onCancel(); }}>{t.face.usePasswordInstead}</Button>}</div>
    </div>;
  }
  const helperText = tr('Reste face à l’objectif, sans tourner la tête. Fais de petits déplacements et garde chaque position jusqu’à sa validation.', 'Keep facing the lens without turning your head. Make small sideways movements and hold each position until it is confirmed.', 'ابقَ مواجهاً للعدسة دون تدوير رأسك. تحرّك قليلاً جانبياً وثبّت كل وضعية حتى يتم تأكيدها.');
  const progressLabels = [t.face.stepCenter, t.face.stepLeft, t.face.stepRight];

  return <div className="mx-auto w-full max-w-xl space-y-4 text-center">
    <div className="flex items-center justify-center gap-2"><Camera className="size-5 text-primary" /><h3 className="font-semibold">{t.face.facialSetupTitle}</h3></div>
    <p className="text-sm text-muted-foreground">{helperText}</p>
    <div className={active ? 'relative overflow-hidden rounded-2xl bg-black' : 'hidden'}>
      <video ref={videoRef} muted playsInline aria-label="Guided camera preview" className="aspect-[4/3] w-full -scale-x-100 object-contain" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-3/5 w-1/2 rounded-[50%] border-2 border-dashed border-white/80" /></div>
      {status === 'ready' && <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white"><Crosshair className="size-4 animate-pulse text-emerald-300" />{currentPrompt}</div>}
    </div>
    {active && <>
      <div className="flex gap-1" aria-label={tr('Progression de la capture', 'Capture progress', 'تقدم الالتقاط')}>
        {Array.from({ length: requiredFrames }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index < pose ? 'bg-emerald-500' : index === pose ? 'animate-pulse bg-primary' : 'bg-muted'}`} />)}
      </div>
      <div className="flex justify-between gap-2 text-xs">
        {progressLabels.map((label, index) => <span key={index} className={`inline-flex items-center gap-1 ${index < pose ? 'text-emerald-600' : index === pose ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
          {index < pose ? <CheckCircle2 className="size-4" /> : scanMode === 'multi_pose' && index === 1 ? <ArrowLeft className="size-4 animate-pulse" /> : scanMode === 'multi_pose' && index === 2 ? <ArrowRight className="size-4 animate-pulse" /> : null}{label}
        </span>)}
      </div>
      <div role="status">{status === 'requesting' ? <EasyJobLoading label={tr('Chargement de la caméra et des modèles…', 'Loading camera and models…', 'جارٍ تحميل الكاميرا والنماذج…')} /> : currentPrompt}</div>
      {feedback && <p aria-live="polite" className="text-sm">{feedback}</p>}
    </>}
    {['denied', 'unavailable', 'error'].includes(status) && <p role="alert" className="text-sm text-destructive">{status === 'denied' ? t.face.cameraDenied : status === 'unavailable' ? t.face.cameraUnavailable : tr('Détection indisponible. Vérifiez la caméra et le chargement des modèles, puis réessayez.', 'Face detection unavailable. Check the camera and model loading, then retry.', 'اكتشاف الوجه غير متاح. تحقّق من الكاميرا وتحميل النماذج ثم أعد المحاولة.')}</p>}
    <div className="flex flex-wrap justify-center gap-2">{!active && pose < requiredFrames && <Button onClick={start}>{status === 'idle' ? t.face.cameraPermission : t.face.tryAgain}</Button>}{onCancel && <Button variant="outline" onClick={() => { stop(); onCancel(); }}>{t.face.usePasswordInstead}</Button>}</div>
  </div>;
}
