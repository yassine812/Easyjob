import { api } from './client';

export interface BiometricStatus {
  enabled: boolean;
  enrolled: boolean;
  consentAt: string | null;
  lastUsedAt: string | null;
}

export interface EnrollmentStartResponse {
  enrollmentId: string;
  expiresAt: string;
}

export interface FaceLoginStartResponse {
  challengeId: string;
  expiresAt: string;
}

export interface FaceLoginUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
}

export interface FaceLoginResponse {
  accessToken: string;
  user: FaceLoginUser;
}

/** Compresses a captured canvas frame to a JPEG Blob (≤ ~1.5 MB). */
export function frameToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode frame'))),
      'image/jpeg',
      0.95,
    );
  });
}

export const biometricApi = {
  /** GET /biometric/status — whether face login is enabled for the current user. */
  status: () => api.get<BiometricStatus>('/biometric/status'),

  /** POST /biometric/enroll/start — explicit consent, returns a single-use enrollment session. */
  enrollStart: (consent: boolean) =>
    api.post<EnrollmentStartResponse>('/biometric/enroll/start', { consent }),

  /**
   * POST /biometric/enroll/verify — two camera frames (JPEG) complete enrollment.
   * The backend runs quality + liveness + embedding and stores the encrypted template.
   */
  enrollVerify: (enrollmentId: string, frameA: Blob, frameB: Blob, frameC?: Blob) => {
    const form = new FormData();
    form.append('enrollmentId', enrollmentId);
    if (frameC) form.append('frame_c', frameC, 'frame_c.jpg');
    form.append('frame_a', frameA, 'frame_a.jpg');
    form.append('frame_b', frameB, 'frame_b.jpg');
    return api.post<{ enrolled: boolean }>('/biometric/enroll/verify', undefined, { body: form });
  },

  /** Builds the encrypted reference template from the selected profile photo. */
  enrollFromPhoto: async (photo: Blob) => {
    const { enrollmentId } = await biometricApi.enrollStart(true);
    const form = new FormData();
    form.append('enrollmentId', enrollmentId);
    form.append('photo', photo, 'profile-photo.jpg');
    return api.post<{ enrolled: boolean }>('/biometric/enroll/photo', undefined, { body: form });
  },

  /** DELETE /biometric — permanently disables face login and deletes the stored template. */
  disable: () => api.delete<{ disabled: boolean }>('/biometric'),

  /** POST /auth/face/start — public: starts a short-lived single-use challenge for face login. */
  faceStart: (email: string) =>
    api.post<FaceLoginStartResponse>('/auth/face/start', { email }, { auth: false }),

  /**
   * POST /auth/face/verify — public: verifies the live frames against the stored
   * encrypted template and (on success) issues the normal JWT + httpOnly refresh cookie.
   */
  faceVerify: (email: string, challengeId: string, frameA: Blob, frameB: Blob) => {
    const form = new FormData();
    form.append('email', email);
    form.append('challengeId', challengeId);
    form.append('frame_a', frameA, 'frame_a.jpg');
    form.append('frame_b', frameB, 'frame_b.jpg');
    return api.post<FaceLoginResponse>('/auth/face/verify', undefined, { auth: false, body: form });
  },
};
