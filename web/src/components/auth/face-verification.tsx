'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ScanFace } from 'lucide-react';
import { biometricApi } from '@/lib/api/biometric';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FaceCamera } from './face-camera';

type Stage = 'email' | 'camera' | 'processing';

interface FaceVerificationProps {
  /** Rendered under the failure message ("Use password instead"). */
  onUsePassword: () => void;
}

function faceErrorMessage(err: unknown, t: ReturnType<typeof useI18n>['t']): string {
  if (!(err instanceof ApiError) && !(err instanceof Error)) return t.face.errorGeneric;
  const message =
    err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? err.message) : err.message;
  const lower = message.toLowerCase();
  if (lower.includes('temporarily unavailable')) return t.face.errorAiUnavailable;
  if (lower.includes('too many attempts')) return t.face.errorTooManyAttempts;
  if (lower.includes('expired') || lower.includes('start a fresh')) return t.face.errorChallengeExpired;
  if (lower.includes('liveness')) return t.face.errorLivenessFailed;
  if (lower.includes('no face')) return t.face.errorNoFace;
  if (lower.includes('not enabled') || lower.includes('disabled')) return t.face.errorBiometricDisabled;
  return t.face.errorFaceMismatch;
}

export function FaceVerification({ onUsePassword }: FaceVerificationProps) {
  const { t } = useI18n();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setLastEmail = useAuthStore((s) => s.setLastEmail);
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState(() => useAuthStore.getState().lastEmail ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);

  const start = useCallback(async () => {
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEmailError(t.face.emailForFace);
      return;
    }
    setEmailError(null);
    try {
      const challenge = await biometricApi.faceStart(email);
      setChallengeId(challenge.challengeId);
      setStage('camera');
    } catch {
      // Generic error — never reveal whether the account exists or has
      // biometrics enabled (anti-enumeration).
      setError(t.face.errorFaceMismatch);
    }
  }, [email, t]);

  const handleCaptured = useCallback(
    async (frameA: Blob, frameB: Blob) => {
      if (!challengeId) return;
      setStage('processing');
      setError(null);
      try {
        const { accessToken } = await biometricApi.faceVerify(email, challengeId, frameA, frameB);
        const { establishSession } = await import('@/lib/auth-session');
        const user = await establishSession(accessToken, email);
        setLastEmail(email);

        toast.success(t.face.identityVerified);
        const { getDashboardRoute } = await import('@/lib/permissions');
        router.replace(getDashboardRoute(user));
      } catch (err) {
        setError(faceErrorMessage(err, t));
        // Remount the camera fresh so the user can retry the scan.
        setCameraKey((k) => k + 1);
        setStage('camera');
        setChallengeId(null);
      }
    },
    [challengeId, email, router, setLastEmail, t],
  );

  if (stage === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-semibold">{t.face.authenticating}</p>
        <p className="text-sm text-muted-foreground">{t.face.processingBody}</p>
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
        <div className="flex justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStage('email')}>
            {t.face.emailForFace}
          </Button>
        </div>
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
    </div>
  );
}
