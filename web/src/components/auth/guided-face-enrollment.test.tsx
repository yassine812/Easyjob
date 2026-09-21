import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaceEnrollment } from './face-enrollment';
import { GuidedFaceCamera } from './guided-face-camera';
import { I18nProvider } from '@/lib/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { observeFace } from '@/lib/face-guidance';
import { frameToBlob } from '@/lib/api/biometric';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const enrollStartMock = vi.fn();
const enrollVerifyMock = vi.fn();
let observation = 0;
vi.mock('@/lib/face-guidance', () => ({
  loadFaceGuidance: vi.fn().mockResolvedValue({}),
  observeFace: vi.fn().mockResolvedValue([{ detection: { box: { x: 200, width: 240 } } }]),
  capturePosition: () => ['center', 'left', 'right'][Math.min(2, Math.floor(observation++ / 6))],
}));

vi.mock('@/lib/api/biometric', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    frameToBlob: vi.fn().mockResolvedValue(new Blob(['test-image'], { type: 'image/jpeg' })),
    biometricApi: {
      enrollStart: (...a: unknown[]) => enrollStartMock(...a),
      enrollVerify: (...a: unknown[]) => enrollVerifyMock(...a),
    },
  };
});

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

describe('Guided Face Enrollment & Multi-Pose Setup', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    observation = 0;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    // Mock getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
  });

  it('renders camera permission request step and handles approval', async () => {
    renderWithProviders(<GuidedFaceCamera onComplete={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Camera permission/i })).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /Camera permission/i });
    await userEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Center/i)).toBeInTheDocument();
    });
  });

  it('handles camera permission denial gracefully with retry option', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    renderWithProviders(<GuidedFaceCamera onComplete={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /Camera permission|Continue/i });
    await userEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Camera access denied|denied/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });

  it('uploads only snapshots that passed detection, after three stable observations per position', async () => {
    const onCompleteMock = vi.fn();
    renderWithProviders(<GuidedFaceCamera onComplete={onCompleteMock} />);

    const startBtn = screen.getByRole('button', { name: /Camera permission|Continue/i });
    await userEvent.click(startBtn);

    // Step 1: Center
    await waitFor(() => {
      expect(screen.getByText(/Center/i)).toBeInTheDocument();
    });

    // Step 2 & 3 Auto Sequence
    await waitFor(
      () => {
        expect(onCompleteMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );
    expect(vi.mocked(observeFace).mock.calls.length).toBeGreaterThanOrEqual(9);
    const detected = vi.mocked(observeFace).mock.calls.map(args => args[0]);
    expect(vi.mocked(frameToBlob).mock.calls).toHaveLength(3);
    for (const [snapshot] of vi.mocked(frameToBlob).mock.calls) {
      expect(snapshot).toBeInstanceOf(HTMLCanvasElement);
      expect(detected).toContain(snapshot);
    }
  });

  it('completes candidate / company enrollment via FaceEnrollment wrapper', async () => {
    enrollStartMock.mockResolvedValue({ enrollmentId: 'test-enrollment-123', expiresAt: '2026-12-31' });
    enrollVerifyMock.mockResolvedValue({ enrolled: true });

    const onDoneMock = vi.fn();
    renderWithProviders(<FaceEnrollment onDone={onDoneMock} />);

    // Consent step
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    const enableBtn = screen.getByRole('button', { name: /Enable Face Login/i });
    await userEvent.click(enableBtn);

    await waitFor(() => {
      expect(enrollStartMock).toHaveBeenCalledWith(true);
    });
  });
});
