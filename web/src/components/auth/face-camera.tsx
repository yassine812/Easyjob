'use client';

import { useI18n } from '@/lib/i18n';
import { GuidedFaceCamera } from './guided-face-camera';

/** Login shares the real face detection and camera lifecycle used by enrollment. */
export function FaceCamera({ onCaptured, onCancel }: {
  onCaptured: (frameA: Blob, frameB: Blob) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{t.face.cameraPermissionBody}</p>
    <GuidedFaceCamera onComplete={(center, left) => onCaptured(center, left)} onCancel={onCancel} />
  </div>;
}
