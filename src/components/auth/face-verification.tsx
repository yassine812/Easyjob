'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ScanFace } from 'lucide-react';
import { biometricApi } from '@/lib/api/biometric';
import { useI18n } from '@/lib/i18n';
import { useReleaseText } from '@/lib/i18n/release';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FaceCamera } from './face-camera';

type Stage = 'email' | 'starting' | 'camera' | 'processing' | 'retry';

interface FaceVerificationProps {
  /** Rendered under the failure message ("Use password instead"). */
  onUsePassword: () => void;
  /** The email already entered on the login form. When present, skip the duplicate email step. */
  initialEmail?: string;
}

function faceErrorMessage(err: unknown, t: ReturnType<typeof useI18n>['t'], tr: ReturnType<typeof useReleaseText>): string {
  if (err instanceof ApiError && err.status === 0) return tr('Le serveur EasyJob est injoignable. Attends quelques instants, puis réessaie.', 'The EasyJob server cannot be reached. Wait a moment, then try again.', 'تعذر الاتصال بخادم EasyJob. انتظر قليلاً ثم أعد المحاولة.');
  if (err instanceof ApiError && err.status >= 500) return t.face.errorAiUnavailable;
  if (err instanceof ApiError && err.status === 429) return t.face.errorTooManyAttempts;
  if (!(err instanceof ApiError) && !(err instanceof Error)) return t.face.errorGeneric;
  const raw = err instanceof ApiError ? ((err.body as { message?: string | string[] } | null)?.message ?? err.message) : err.message;
  const message = Array.isArray(raw) ? raw.join(' ') : raw;
  const lower = message.toLowerCase();
  if (err instanceof ApiError && err.status === 422 && lower.startsWith('face_capture:')) {
    switch (lower.slice('face_capture:'.length)) {
      case 'no_face': return t.face.errorNoFace;
      case 'multiple_faces':
      case 'face_count_changed': return t.face.errorMultipleFaces;
      case 'face_too_small': return tr('Rapproche-toi de la caméra : ton visage est trop petit dans l’image.', 'Move closer to the camera: your face is too small in the image.', 'اقترب من الكاميرا: وجهك صغير جداً في الصورة.');
      case 'bad_angle':
      case 'face_moved': return tr('Garde ton visage de face et dans le cadre, sans tourner la tête.', 'Keep your face forward and inside the frame, without turning your head.', 'أبقِ وجهك مواجهاً للكاميرا داخل الإطار دون تدوير رأسك.');
      case 'no_motion': return tr('Les images sont trop semblables pour confirmer un visage en direct. Réessaie en restant de face, naturellement.', 'The images are too similar to confirm a live face. Try again while facing the camera naturally.', 'الصور متشابهة جداً لتأكيد وجه حي. أعد المحاولة وأنت تواجه الكاميرا بشكل طبيعي.');
      case 'liveness_failed': return t.face.errorLivenessFailed;
      default: return tr('L’image du visage est trop floue ou inexploitable. Éclaire ton visage et vérifie l’objectif avant de réessayer.', 'The face image is blurry or unusable. Light your face and check the lens before retrying.', 'صورة الوجه ضبابية أو غير صالحة. حسّن الإضاءة وتحقّق من العدسة ثم أعد المحاولة.');
    }
  }
  if (lower.includes('temporarily unavailable')) return t.face.errorAiUnavailable;
  if (lower.includes('too many attempts')) return t.face.errorTooManyAttempts;
  if (lower.includes('expired') || lower.includes('start a fresh')) return t.face.errorChallengeExpired;
  if (lower.includes('liveness')) return t.face.errorLivenessFailed;
  if (lower.includes('no face')) return t.face.errorNoFace;
  if (lower.includes('not enabled') || lower.includes('disabled')) return t.face.errorBiometricDisabled;
  return t.face.errorFaceMismatch;
}

export function FaceVerification({ onUsePassword, initialEmail }: FaceVerificationProps) {
  const { t } = useI18n();
  const tr = useReleaseText();
  const router = useRouter();
  const setLastEmail = useAuthStore((s) => s.setLastEmail);
  const [email, setEmail] = useState(() => initialEmail?.trim() || useAuthStore.getState().lastEmail || '');
  const [validInitialEmail] = useState(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()));
  const [stage, setStage] = useState<Stage>(validInitialEmail ? 'starting' : 'email');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const autoStarted = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    setNeedsEmailVerification(false);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEmailError(t.face.emailForFace);
      return;
    }
    setEmailError(null);
    setChallengeId(null);
    setStage('starting');
    try {
      const challenge = await biometricApi.faceStart(email.trim().toLowerCase());
      setChallengeId(challenge.challengeId);
      setStage('camera');
    } catch (err) {
      setError(faceErrorMessage(err, t, tr));
      setStage('retry');
    }
  }, [email, t, tr]);

  useEffect(() => {
    if (!validInitialEmail || autoStarted.current) return;
    autoStarted.current = true;
    void start();
  }, [start, validInitialEmail]);

  const handleCaptured = useCallback(
    async (frameA: Blob, frameB: Blob) => {
      if (!challengeId) return;
      setStage('processing');
      setError(null);
      try {
        const { accessToken } = await biometricApi.faceVerify(email.trim().toLowerCase(), challengeId, frameA, frameB);
        const { establishSession } = await import('@/lib/auth-session');
        const user = await establishSession(accessToken, email);
        setLastEmail(email);

        toast.success(t.face.identityVerified);
        const { getDashboardRoute } = await import('@/lib/permissions');
        router.replace(getDashboardRoute(user));
      } catch (err) {
        const verificationRequired = err instanceof ApiError && err.status === 403 && (
          (err.body as { code?: string } | null)?.code === 'EMAIL_VERIFICATION_REQUIRED'
          // The shared HTTP exception filter preserves the message, not custom codes.
          || err.message === 'Confirm your email before signing in with your face.'
        );
        setNeedsEmailVerification(verificationRequired);
        setError(verificationRequired
          ? tr('Votre visage est reconnu. Confirmez votre adresse e-mail pour terminer la connexion.', 'Your face is recognized. Confirm your email address to finish signing in.', 'تم التعرف على وجهك. أكّد بريدك الإلكتروني لإتمام تسجيل الدخول.')
          : faceErrorMessage(err, t, tr));
        // Retry explicitly, with a fresh single-use challenge. Never loop scans.
        setCameraKey((k) => k + 1);
        setChallengeId(null);
        setStage('retry');
      }
    },
    [challengeId, email, router, setLastEmail, t, tr],
  );

  if (stage === 'retry') {
    return <div className="space-y-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
          <ScanFace className="size-5" />
        </span>
        <Alert variant="destructive" className="min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
      {!needsEmailVerification && <p className="pl-12 text-xs leading-relaxed text-muted-foreground">
        {tr('Réessaie face à la caméra, dans une pièce bien éclairée, avec une seule personne dans le cadre.', 'Try again facing the camera in good light, with only one person in the frame.', 'أعد المحاولة أمام الكاميرا في إضاءة جيدة، مع شخص واحد فقط داخل الإطار.')}
      </p>}
      {needsEmailVerification
        ? <Button className="h-11 w-full" onClick={() => { setLastEmail(email); router.push('/verify-email?send=1'); }}>{tr('Confirmer mon e-mail', 'Confirm my email', 'تأكيد بريدي الإلكتروني')}</Button>
        : <Button className="h-11 w-full" onClick={start}>{t.face.tryAgain}</Button>}
      <Button variant="ghost" className="h-10 w-full" onClick={onUsePassword}>{t.face.signInWithPassword}</Button>
    </div>;
  }

  if (stage === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-semibold">{t.face.authenticating}</p>
        <p className="text-sm text-muted-foreground">{t.face.processingBody}</p>
      </div>
    );
  }

  if (stage === 'starting') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-semibold">{t.face.cameraPermission}</p>
        <p className="text-sm text-muted-foreground">{t.face.cameraPermissionBody}</p>
      </div>
    );
  }

  if (stage === 'camera') {
    return (
      <div className="space-y-4">
        <FaceCamera key={cameraKey} onCaptured={handleCaptured} onCancel={onUsePassword} />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  // email stage
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ScanFace className="h-4 w-4" />
        <span className="text-sm">{t.face.emailForFace}</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="face-email">{t.face.emailForFace}</Label>
        <Input
          id="face-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          placeholder="you@example.com"
          aria-invalid={!!emailError}
        />
        {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
      </div>
      <Button onClick={start} className="w-full">
        {t.face.continueLabel}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button variant="ghost" className="w-full text-xs font-semibold" onClick={onUsePassword}>
        {t.face.signInWithPassword}
      </Button>
    </div>
  );
}
