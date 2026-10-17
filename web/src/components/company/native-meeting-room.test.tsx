import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NativeMeetingRoom } from './native-meeting-room';

const media = vi.hoisted(() => {
  const local = { identity: 'hr', name: 'Recruiter', isSpeaking: false, isMicrophoneEnabled: false, isCameraEnabled: false, isScreenShareEnabled: false, getTrackPublication: vi.fn(), setCameraEnabled: vi.fn(), setMicrophoneEnabled: vi.fn(), setScreenShareEnabled: vi.fn() };
  return { local, handlers: {} as Record<string, (...args: unknown[]) => void>, disconnect: vi.fn(), connect: vi.fn() };
});
vi.mock('livekit-client', () => ({
  ConnectionState: { Connecting: 'connecting', Connected: 'connected', Reconnecting: 'reconnecting', SignalReconnecting: 'signalReconnecting', Disconnected: 'disconnected' },
  RoomEvent: Object.fromEntries(['ParticipantConnected','ParticipantDisconnected','TrackSubscribed','TrackUnsubscribed','LocalTrackPublished','LocalTrackUnpublished','TrackMuted','TrackUnmuted','ActiveSpeakersChanged','AudioPlaybackStatusChanged','ConnectionStateChanged','MediaDevicesError'].map(name => [name, name])),
  Track: { Source: { Camera: 'camera', ScreenShare: 'screen_share' } },
  Room: class {
    localParticipant = media.local; remoteParticipants = new Map(); canPlaybackAudio = true;
    on(name: string, callback: (...args: unknown[]) => void) { media.handlers[name] = callback; }
    connect = media.connect; disconnect = media.disconnect; removeAllListeners() {}
  },
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/hiring', () => ({ useHiringText: () => (key: string) => key }));
vi.mock('@/components/ui/easyjob-loader', () => ({ EasyJobLoading: () => <div>EasyJob</div> }));
beforeEach(() => {
  vi.clearAllMocks(); media.handlers = {}; media.local.isMicrophoneEnabled = false; media.local.isCameraEnabled = false; media.local.isScreenShareEnabled = false;
  media.connect.mockImplementation(async () => { media.handlers.ConnectionStateChanged('connected'); });
  media.local.setCameraEnabled.mockImplementation(async value => { media.local.isCameraEnabled = value; });
  media.local.setMicrophoneEnabled.mockImplementation(async value => { media.local.isMicrophoneEnabled = value; });
  media.local.setScreenShareEnabled.mockImplementation(async value => { media.local.isScreenShareEnabled = value; });
});
afterEach(cleanup);
const access = { url: 'ws://localhost:7880', token: 'temporary', roomName: 'private-room' };
it('uses native media controls and disconnects on leave', async () => {
  const leave = vi.fn(), joined = vi.fn();
  render(<NativeMeetingRoom access={access} devices={{}} onLeave={leave} onMute={vi.fn()} onJoined={joined} />);
  await waitFor(() => expect(joined).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Micro' })).toHaveAttribute('aria-pressed', 'true'));
  fireEvent.click(screen.getByRole('button', { name: 'Micro' }));
  await waitFor(() => expect(media.local.setMicrophoneEnabled).toHaveBeenLastCalledWith(false));
  fireEvent.click(screen.getByRole('button', { name: 'Partager l’écran' }));
  await waitFor(() => expect(media.local.setScreenShareEnabled).toHaveBeenLastCalledWith(true, { audio: true }));
  fireEvent.click(screen.getByRole('button', { name: 'leave' }));
  expect(media.disconnect).toHaveBeenCalled(); expect(leave).toHaveBeenCalled();
});
it('keeps the participant connected after camera permission failure and offers retry', async () => {
  media.local.setCameraEnabled.mockRejectedValueOnce(new Error('permission denied'));
  const joined = vi.fn();
  render(<NativeMeetingRoom access={access} devices={{}} onLeave={vi.fn()} onMute={vi.fn()} onJoined={joined} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès aux appareils impossible');
  expect(joined).toHaveBeenCalled(); expect(media.disconnect).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Caméra' })).toBeEnabled();
});
