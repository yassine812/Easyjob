import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaceVerification } from './face-verification';
import { FaceEnrollment } from './face-enrollment';
import { FaceStatusCard } from './face-status';
import { LoginForm } from './login-form';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/client';
import { makeUser } from '@/test/factories';
import { I18nProvider } from '@/lib/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const meMock = vi.fn();
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: () => meMock(),
  },
}));

const faceStartMock = vi.fn();
const faceVerifyMock = vi.fn();
const enrollStartMock = vi.fn();
const enrollVerifyMock = vi.fn();
const statusMock = vi.fn();
const disableMock = vi.fn();
vi.mock('./guided-face-camera', () => ({ GuidedFaceCamera: ({ onComplete, onCancel }: { onComplete: (a: Blob, b: Blob, c: Blob) => void; onCancel?: () => void }) =>
  <><button onClick={() => onComplete(new Blob(['center']), new Blob(['left']), new Blob(['right']))}>Camera permission</button>{onCancel && <button onClick={onCancel}>Use password instead</button>}</>,
}));
vi.mock('@/lib/api/biometric', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    biometricApi: {
      status: () => statusMock(),
      enrollStart: (...a: unknown[]) => enrollStartMock(...a),
      enrollVerify: (...a: unknown[]) => enrollVerifyMock(...a),
      disable: () => disableMock(),
      faceStart: (...a: unknown[]) => faceStartMock(...a),
      faceVerify: (...a: unknown[]) => faceVerifyMock(...a),
    },
  };
});

function renderWithI18n(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  meMock.mockReset();
  faceStartMock.mockReset();
  faceVerifyMock.mockReset();
  enrollStartMock.mockReset();
  enrollVerifyMock.mockReset();
  statusMock.mockReset();
  disableMock.mockReset();
  useAuthStore.getState().clearSession();
  useAuthStore.getState().setLastEmail('');
  // jsdom has no mediaDevices — simulate a granted camera.
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
  // HTMLCanvasElement.toBlob
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['fake-frame'], { type: 'image/jpeg' }));
  };
});

describe('FaceVerification', () => {
  it('starts a face-login challenge with the provided email', async () => {
    faceStartMock.mockResolvedValue({ challengeId: 'challenge-123', expiresAt: '2026-01-01' });
    const user = userEvent.setup();
    renderWithI18n(<FaceVerification onUsePassword={vi.fn()} />);

    await user.type(screen.getByLabelText(/account email/i), 'c@test.dev');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(faceStartMock).toHaveBeenCalledWith('c@test.dev'));
    expect(await screen.findByRole('button', { name: /camera permission/i })).toBeInTheDocument();
  });

  it('reports an offline server without claiming the face failed or asking for the email again', async () => {
    faceStartMock.mockRejectedValueOnce(new ApiError(0, 'Network error'))
      .mockResolvedValueOnce({ challengeId: 'recovered' });
    renderWithI18n(<FaceVerification initialEmail="c@test.dev" onUsePassword={vi.fn()} />);

    expect(await screen.findByText(/server cannot be reached/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/account email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/face verification failed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /camera permission/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: /camera permission/i })).toBeInTheDocument();
    expect(faceStartMock).toHaveBeenCalledTimes(2);
  });

  it('opens the camera directly for a remembered email', async () => {
    useAuthStore.getState().setLastEmail('c@test.dev');
    faceStartMock.mockResolvedValue({ challengeId: 'remembered' });
    renderWithI18n(<FaceVerification onUsePassword={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /camera permission/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/account email/i)).not.toBeInTheDocument();
    expect(faceStartMock).toHaveBeenCalledWith('c@test.dev');
  });

  it('retries a rejected scan with a fresh challenge without repeating the email', async () => {
    faceStartMock.mockResolvedValueOnce({ challengeId: 'first' }).mockResolvedValueOnce({ challengeId: 'second' });
    faceVerifyMock.mockRejectedValue(new ApiError(401, 'Face verification failed.'));
    renderWithI18n(<FaceVerification initialEmail="c@test.dev" onUsePassword={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /camera permission/i }));
    expect(await screen.findByText(/face verification failed/i)).toBeInTheDocument();
    expect(faceStartMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(/account email/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await userEvent.click(await screen.findByRole('button', { name: /camera permission/i }));
    await waitFor(() => expect(faceVerifyMock).toHaveBeenCalledTimes(2));
    expect(faceVerifyMock.mock.calls.map(args => args[1])).toEqual(['first', 'second']);
  });

  it('directs a recognized face to email confirmation without creating a session', async () => {
    faceStartMock.mockResolvedValue({ challengeId: 'unverified' });
    faceVerifyMock.mockRejectedValue(new ApiError(403, 'Confirm your email before signing in with your face.', {
      statusCode: 403, message: 'Confirm your email before signing in with your face.', error: 'ForbiddenException',
    }));
    renderWithI18n(<FaceVerification initialEmail="c@test.dev" onUsePassword={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /camera permission/i }));
    expect(await screen.findByText(/your face is recognized/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /confirm my email/i }));
    expect(push).toHaveBeenCalledWith('/verify-email?send=1');
    expect(useAuthStore.getState().lastEmail).toBe('c@test.dev');
    expect(useAuthStore.getState().accessToken).toBeFalsy();
    expect(meMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no_motion', /images are too similar/i],
    ['no_face', /no face detected/i],
    ['low_quality', /blurry or unusable/i],
    ['face_too_small', /move closer/i],
  ])('explains rejected capture %s without calling it an identity mismatch', async (code, message) => {
    faceStartMock.mockResolvedValue({ challengeId: 'capture-check' });
    faceVerifyMock.mockRejectedValue(new ApiError(422, `FACE_CAPTURE:${code}`));
    renderWithI18n(<FaceVerification initialEmail="c@test.dev" onUsePassword={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /camera permission/i }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/face verification failed/i)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(meMock).not.toHaveBeenCalled();
  });

  it('shows a generic error when the account does not exist (anti-enumeration)', async () => {
    faceStartMock.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithI18n(<FaceVerification onUsePassword={vi.fn()} />);

    await user.type(screen.getByLabelText(/account email/i), 'nobody@test.dev');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/face verification failed/i)).toBeInTheDocument());
  });

  it('captures frames, verifies, and sets the session', async () => {
    const candidate = makeUser({ id: 'u2', roles: ['CANDIDATE'], email: 'c@test.dev' });
    meMock.mockResolvedValue(candidate);
    faceStartMock.mockResolvedValue({ challengeId: 'ch-1', expiresAt: '2026-01-01' });
    faceVerifyMock.mockResolvedValue({ accessToken: 'tok', user: candidate });
    const onUsePassword = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<FaceVerification onUsePassword={onUsePassword} />);

    await user.type(screen.getByLabelText(/account email/i), 'c@test.dev');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Face detection controls capture; this test checks the authentication result.
    await user.click(screen.getByRole('button', { name: /camera permission/i }));

    await waitFor(() => expect(faceVerifyMock).toHaveBeenCalled());
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('tok'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/candidate/dashboard'));
  });

  it('falls back to password login from the camera step', async () => {
    faceStartMock.mockResolvedValue({ challengeId: 'ch-2', expiresAt: '2026-01-01' });
    const onUsePassword = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<FaceVerification onUsePassword={onUsePassword} />);

    await user.type(screen.getByLabelText(/account email/i), 'c@test.dev');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('button', { name: /camera permission/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /use password instead/i }));

    expect(onUsePassword).toHaveBeenCalled();
  });
});

describe('FaceEnrollment', () => {
  it('requires explicit consent before starting enrollment', async () => {
    enrollStartMock.mockResolvedValue({ enrollmentId: 'enr-1', expiresAt: '2026-01-01' });
    const user = userEvent.setup();
    renderWithI18n(<FaceEnrollment onDone={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /enable face login/i }));

    expect(enrollStartMock).not.toHaveBeenCalled();
    expect(screen.getByText(/you must consent/i)).toBeInTheDocument();
  });

  it('enrolls with consent and multi-pose scan', async () => {
    enrollStartMock.mockResolvedValue({ enrollmentId: 'enr-1', expiresAt: '2026-01-01' });
    enrollVerifyMock.mockResolvedValue({ enrolled: true });
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<FaceEnrollment onDone={onDone} />);

    await user.click(screen.getByLabelText(/i understand and consent/i));
    await user.click(screen.getByRole('button', { name: /enable face login/i }));

    await waitFor(() => expect(enrollStartMock).toHaveBeenCalledWith(true));
    const permissionBtn = screen.getByRole('button', { name: /Camera permission|Continue/i });
    await user.click(permissionBtn);

    await waitFor(() => expect(enrollVerifyMock).toHaveBeenCalled(), { timeout: 5000 });
    expect(await screen.findByText(/completed|enabled/i)).toBeInTheDocument();
  });

  it('starts a fresh session after a rejected scan without requesting consent again', async () => {
    enrollStartMock.mockResolvedValueOnce({ enrollmentId: 'first' }).mockResolvedValueOnce({ enrollmentId: 'retry' });
    enrollVerifyMock.mockRejectedValueOnce(new Error('No face detected')).mockResolvedValueOnce({ enrolled: true });
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<FaceEnrollment onDone={onDone} />);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /enable face login/i }));
    await user.click(await screen.findByRole('button', { name: /Camera permission/i }));
    expect(await screen.findByText(/No face detected/i)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Try again/i }));
    await user.click(await screen.findByRole('button', { name: /Camera permission/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(enrollStartMock).toHaveBeenCalledTimes(2);
    expect(enrollVerifyMock.mock.calls.map(args => args[0])).toEqual(['first', 'retry']);
  });

  it('surfaces a liveness failure and offers a retry', async () => {
    enrollStartMock.mockResolvedValue({ enrollmentId: 'enr-1', expiresAt: '2026-01-01' });
    enrollVerifyMock.mockRejectedValue(new Error('Liveness check failed'));
    const user = userEvent.setup();
    renderWithI18n(<FaceEnrollment onDone={vi.fn()} />);

    await user.click(screen.getByLabelText(/i understand and consent/i));
    await user.click(screen.getByRole('button', { name: /enable face login/i }));
    const permissionBtn = screen.getByRole('button', { name: /Camera permission|Continue/i });
    await user.click(permissionBtn);

    expect(
      await screen.findByText(/Position check failed|liveness/i, {}, { timeout: 6000 }),
    ).toBeInTheDocument();
  });
});

describe('FaceStatusCard', () => {
  it('shows disabled state and offers enrollment', async () => {
    statusMock.mockResolvedValue({ enabled: true, enrolled: false, consentAt: null, lastUsedAt: null });
    renderWithI18n(<FaceStatusCard />);
    expect(await screen.findByRole('button', { name: /enable face login/i })).toBeInTheDocument();
  });

  it('shows enabled state and allows disabling', async () => {
    statusMock.mockResolvedValue({
      enabled: true,
      enrolled: true,
      consentAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
    });
    disableMock.mockResolvedValue({ disabled: true });
    const user = userEvent.setup();
    renderWithI18n(<FaceStatusCard />);

    expect(await screen.findByRole('button', { name: /disable face login/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /disable face login/i }));
    await waitFor(() => expect(disableMock).toHaveBeenCalled());
  });
});

describe('LoginForm face option', () => {
  it('shows the face-login button and switches to the face flow', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /sign in with face/i }));
    expect(screen.getByLabelText(/account email/i)).toBeInTheDocument();
  });

  it('starts the camera flow with the email already entered on the login form', async () => {
    faceStartMock.mockResolvedValue({ challengeId: 'login-challenge', expiresAt: '2026-01-01' });
    const user = userEvent.setup();
    renderWithI18n(<LoginForm />);
    await user.type(screen.getByLabelText(/Email/i), 'c@test.dev');
    await user.click(screen.getByRole('button', { name: /sign in with face/i }));

    await waitFor(() => expect(faceStartMock).toHaveBeenCalledWith('c@test.dev'));
    expect(screen.queryByLabelText(/account email/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /camera permission/i })).toBeInTheDocument();
  });
});

describe('i18n + RTL', () => {
  afterEach(() => {
    // Reset the module-level locale store between tests.
    window.localStorage.removeItem('ss.locale');
  });

  it('renders French translations for the face-login button', async () => {
    window.localStorage.setItem('ss.locale', 'fr');
    const user = userEvent.setup();
    renderWithI18n(<LoginForm />);
    // The effect hydrates the store after mount.
    expect(await screen.findByRole('button', { name: /se connecter avec le visage/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /se connecter avec le visage/i }));
    expect(screen.getByLabelText(/email de votre compte/i)).toBeInTheDocument();
  });

  it('renders Arabic translations and switches the document to RTL', async () => {
    window.localStorage.setItem('ss.locale', 'ar');
    renderWithI18n(<LoginForm />);
    expect(await screen.findByRole('button', { name: /تسجيل الدخول بالتعرّف على الوجه/i })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('defaults to English when no locale is stored', async () => {
    renderWithI18n(<LoginForm />);
    expect(await screen.findByRole('button', { name: /sign in with face/i })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('ltr');
  });
});
