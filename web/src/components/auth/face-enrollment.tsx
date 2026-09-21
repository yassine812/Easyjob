'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { biometricApi, type BiometricStatus } from '@/lib/api/biometric';
import { useI18n } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GuidedFaceCamera } from './guided-face-camera';

type Step = 'consent' | 'camera' | 'processing' | 'retry' | 'success';

interface FaceEnrollmentProps {
  onDone: (status: BiometricStatus) => void;
  onCancel?: () => void;
  /** Optional candidate-only hook for keeping the verified center frame as a profile photo. */
  onReferenceFrame?: (frame: Blob) => unknown;
}

function faceErrorMessage(err: unknown, t: ReturnType<typeof useI18n>['t']): string {
  if (!(err instanceof ApiError) && !(err instanceof Error)) return t.face.errorGeneric;
  const message =
    err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? err.message) : err.message;
  const lower = message.toLowerCase();
  if (lower.includes('no face')) return t.face.errorNoFace;
  if (lower.includes('multiple faces') || lower.includes('face_count')) return t.face.errorMultipleFaces;
  if (lower.includes('quality') || lower.includes('blur') || lower.includes('small')) return t.face.errorLowQuality;
  if (lower.includes('liveness')) return t.face.errorLivenessFailed;
  if (lower.includes('expired')) return t.face.errorChallengeExpired;
  if (lower.includes('too many attempts')) return t.face.errorTooManyAttempts;
  if (lower.includes('temporarily unavailable')) return t.face.errorAiUnavailable;
  if (lower.includes('disabled')) return t.face.errorBiometricDisabled;
  return t.face.errorGeneric;
}

export function FaceEnrollment({ onDone, onCancel, onReferenceFrame }: FaceEnrollmentProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('consent');
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [starting, setStarting] = useState(false);

  const startEnrollment = useCallback(async () => {
    if (!consent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    setStarting(true);
    setError(null);
    try {
      const { enrollmentId: id } = await biometricApi.enrollStart(true);
      setEnrollmentId(id);
      setStep('camera');
    } catch (err) {
      setError(faceErrorMessage(err, t));
    } finally {
      setStarting(false);
    }
  }, [consent, t]);

  const handleCaptured = useCallback(
    async (frameCenter: Blob, frameLeft: Blob, frameRight: Blob) => {
      if (!enrollmentId) return;
      setStep('processing');
      setError(null);
      try {
        await biometricApi.enrollVerify(enrollmentId, frameCenter, frameLeft, frameRight);
        // Face ID stores an encrypted embedding for matching. Candidates also
        // get the verified center frame in their profile when requested by the
        // onboarding flow; a photo upload must never invalidate enrollment.
        try {
          await onReferenceFrame?.(frameCenter);
        } catch {
          // The biometric credential is already enrolled; profile-photo upload
          // can be retried later from the profile page.
        }
        setStep('success');
        onDone({ enabled: true, enrolled: true, consentAt: new Date().toISOString(), lastUsedAt: null });
      } catch (err) {
        setError(faceErrorMessage(err, t));
        // Remount the camera fresh so the user can retry the scan.
        setCameraKey((k) => k + 1);
        setEnrollmentId(null);
        setStep('retry');
      }
    },
    [enrollmentId, onDone, onReferenceFrame, t],
  );

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="font-semibold">{t.face.setupCompleted || t.face.success}</p>
        <p className="text-sm text-muted-foreground">{t.face.successBody}</p>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-semibold">{t.face.processing}</p>
        <p className="text-sm text-muted-foreground">{t.face.processingBody}</p>
      </div>
    );
  }

  if (step === 'camera') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>{t.face.privacyNotice}</span>
        </div>
        <GuidedFaceCamera key={cameraKey} onComplete={handleCaptured} onCancel={onCancel} />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  if (step === 'retry') return (
    <div className="space-y-4 rounded-lg border p-5">
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      <p className="text-sm text-muted-foreground">{t.face.lookCenter}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={startEnrollment} disabled={starting}>
          {starting ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{t.face.tryAgain}
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>{t.face.usePasswordInstead}</Button>}
      </div>
    </div>
  );

  // consent step
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t.face.consentTitle}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t.face.consentBody}</p>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="biometric-consent"
          checked={consent}
          onCheckedChange={(v) => {
            setConsent(v === true);
            setConsentError(false);
          }}
          aria-invalid={consentError}
        />
        <label htmlFor="biometric-consent" className="text-sm">
          {t.face.consentAgree}
        </label>
      </div>
      {consentError ? <p className="text-sm text-destructive">{t.face.consentRequired}</p> : null}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={startEnrollment} disabled={starting} className="flex-1">
          {t.face.enableFaceLogin}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t.face.usePasswordInstead}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
