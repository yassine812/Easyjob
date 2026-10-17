import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaceEnrollment } from './face-enrollment';
import { GuidedFaceCamera } from './guided-face-camera';
import { FaceCamera } from './face-camera';
import { I18nProvider } from '@/lib/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { capturePosition, observeFace } from '@/lib/face-guidance';
import { frameToBlob } from '@/lib/api/biometric';
import { faceImageSharpness } from '@/lib/face-image-quality';

vi.mock('@/lib/face-image-quality', () => ({ faceImageSharpness: vi.fn(() => 120) }));

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
  capturePosition: vi.fn(() => ['center', 'left', 'right'][Math.min(2, Math.floor(observation++ / 6))]),
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
    vi.mocked(faceImageSharpness).mockReturnValue(120);
    vi.mocked(capturePosition).mockImplementation(() => ['center', 'left', 'right'][Math.min(2, Math.floor(observation++ / 6))] as 'center' | 'left' | 'right');
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(HTMLMediaElement.HAVE_ENOUGH_DATA);
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

  it('starts a usable camera automatically under Strict Mode and stops it on unmount', async () => {
    const stop = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    const view = renderWithProviders(<StrictMode><GuidedFaceCamera autoStart scanMode="frontal" onComplete={vi.fn()} /></StrictMode>);
    await waitFor(() => expect(observeFace).toHaveBeenCalled());
    expect(screen.queryByText(/Loading camera and models/i)).not.toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
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

  it('enables supported autofocus and keeps scanning if exposure settings are refused', async () => {
    const applyConstraints = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Driver refused'));
    const track = { stop: vi.fn(), getCapabilities: () => ({ focusMode: ['manual', 'continuous'], exposureMode: ['continuous'] }), applyConstraints };
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream);
    const view = renderWithProviders(<FaceCamera onCaptured={vi.fn()} />);
    await waitFor(() => expect(observeFace).toHaveBeenCalled());
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: 'continuous' }] });
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: 'continuous', exposureMode: 'continuous' }] });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    view.unmount();
  });

  it('waits for a decoded video frame before scanning', async () => {
    const ready = vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(HTMLMediaElement.HAVE_METADATA);
    const view = renderWithProviders(<FaceCamera onCaptured={vi.fn()} />);
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(observeFace).not.toHaveBeenCalled();
    ready.mockReturnValue(HTMLMediaElement.HAVE_ENOUGH_DATA);
    await waitFor(() => expect(observeFace).toHaveBeenCalled());
    view.unmount();
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

  it('automatically captures two frontal frames for login without lateral steps', async () => {
    vi.mocked(capturePosition).mockReturnValue('center');
    const onCaptured = vi.fn();
    renderWithProviders(<FaceCamera onCaptured={onCaptured} />);
    expect(screen.getByTestId('face-login-scan')).toBeInTheDocument();
    expect(screen.queryByText(/Turn left|Turn right|Scan 1|Scan 2|Facial recognition setup/i)).not.toBeInTheDocument();
    await waitFor(() => expect(onCaptured).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(onCaptured.mock.calls[0]).toHaveLength(2);
    expect(frameToBlob).toHaveBeenCalledTimes(2);
  });

  it('attempts comparison for a detected frontal face even when sharpness stays low', async () => {
    vi.mocked(capturePosition).mockReturnValue('center');
    vi.mocked(faceImageSharpness).mockReturnValue(10);
    const onCaptured = vi.fn();
    renderWithProviders(<FaceCamera onCaptured={onCaptured} />);
    expect(await screen.findByText(/Focusing/i)).toBeInTheDocument();
    await waitFor(() => expect(faceImageSharpness).toHaveBeenCalled(), { timeout: 4000 });
    expect(screen.getByText(/comparison will still be attempted/i)).toBeInTheDocument();
    await waitFor(() => expect(onCaptured).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(frameToBlob).toHaveBeenCalledTimes(2);
  });

  it('selects the sharpest detected image within a capture window', async () => {
    vi.mocked(capturePosition).mockReturnValue('center');
    const candidates: HTMLCanvasElement[] = [];
    vi.mocked(faceImageSharpness).mockImplementation(canvas => {
      candidates.push(canvas);
      return candidates.length === 2 ? 150 : 10;
    });
    const onCaptured = vi.fn();
    renderWithProviders(<FaceCamera onCaptured={onCaptured} />);
    await waitFor(() => expect(onCaptured).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(frameToBlob).toHaveBeenCalledTimes(2);
    expect(vi.mocked(frameToBlob).mock.calls[0][0]).toBe(candidates[1]);
    expect(vi.mocked(frameToBlob).mock.calls[1][0]).not.toBe(candidates[1]);
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
