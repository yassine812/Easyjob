'use client';

import { GuidedFaceCamera } from './guided-face-camera';

/** Login shares the real face detection and camera lifecycle used by enrollment. */
export function FaceCamera({ onCaptured, onCancel }: {
  onCaptured: (frameA: Blob, frameB: Blob) => void;
  onCancel?: () => void;
}) {
  return <GuidedFaceCamera autoStart scanMode="frontal" onComplete={(center, second) => onCaptured(center, second)} onCancel={onCancel} />;
}
