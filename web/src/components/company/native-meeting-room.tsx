'use client';
import { useEffect, useRef, useState } from 'react';
import { ConnectionState, Room, RoomEvent, Track, type Participant, type TrackPublication } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users, Settings2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import { useMeetingText } from './meeting-copy';
import styles from './native-meeting-room.module.css';

export interface MeetingAccess { url: string; token: string; roomName: string }
export interface DevicePreferences { audioinput?: string; videoinput?: string; audiooutput?: string }

export function MeetingDevicePicker({ value, onChange, refresh = 0 }: { value: DevicePreferences; onChange: (next: DevicePreferences) => void; refresh?: number }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), t = useMeetingText();
  useEffect(() => {
    let mounted = true;
    const update = () => { void navigator.mediaDevices?.enumerateDevices().then(items => { if (mounted) setDevices(items); }).catch(() => undefined); };
    update(); navigator.mediaDevices?.addEventListener('devicechange', update);
    return () => { mounted = false; navigator.mediaDevices?.removeEventListener('devicechange', update); };
  }, [refresh]);
  return <div className={styles.devicePicker}>{(['videoinput', 'audioinput', 'audiooutput'] as const).map(kind => <label key={kind}>{t(kind === 'videoinput' ? 'camera' : kind === 'audioinput' ? 'microphone' : 'speakers')}<select value={value[kind] ?? ''} onChange={event => onChange({ ...value, [kind]: event.target.value })}><option value="">{t('defaultDevice')}</option>{devices.filter(device => device.kind === kind && device.deviceId).map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${t('device')} ${i + 1}`}</option>)}</select></label>)}</div>;
}

function MediaTrack({ publication, local, audio = false }: { publication?: TrackPublication; local: boolean; audio?: boolean }) {
  const node = useRef<HTMLMediaElement | null>(null), track = publication?.track;
  useEffect(() => {
    const element = node.current;
    if (!track || !element) return;
    track.attach(element);
    return () => { track.detach(element); };
  }, [track, publication?.isMuted]);
  if (!track || publication?.isMuted) return null;
  return audio ? <audio ref={element => { node.current = element; }} autoPlay /> : <video ref={element => { node.current = element; }} autoPlay playsInline muted={local} />;
}

function ParticipantTile({ person, local, screen = false }: { person: Participant; local: boolean; screen?: boolean }) {
  const t = useMeetingText(), publication = person.getTrackPublication(screen ? Track.Source.ScreenShare : Track.Source.Camera);
  const visible = !!publication?.track && !publication.isMuted;
  return <article className={`${styles.tile} ${person.isSpeaking ? styles.speaking : ''} ${screen ? styles.screen : ''}`} aria-label={person.name || person.identity}>
    {visible ? <MediaTrack publication={publication} local={local} /> : <span className={styles.avatar}>{(person.name || '?').split(/\s+/).map(word => word[0]).slice(0, 2).join('')}</span>}
    <div className={styles.name}>{!person.isMicrophoneEnabled && <MicOff size={14} />}<span>{person.name || person.identity}{local ? ` · ${t('you')}` : ''}{screen ? ` · ${t('screenShare')}` : ''}</span></div>
  </article>;
}

export function NativeMeetingRoom({ access, devices, onLeave, onMute, onJoined }: { access: MeetingAccess; devices: DevicePreferences; onLeave: () => void; onMute: (muted: boolean) => void; onJoined: () => void }) {
  const t = useMeetingText(), callbacks = useRef({ onLeave, onMute, onJoined }); callbacks.current = { onLeave, onMute, onJoined };
  const [room, setRoom] = useState<Room | null>(null), [, setRevision] = useState(0), [connection, setConnection] = useState<ConnectionState>(ConnectionState.Connecting);
  const [error, setError] = useState(false), [busy, setBusy] = useState(false), [settings, setSettings] = useState(false), [participantsOpen, setParticipantsOpen] = useState(false), [preferences, setPreferences] = useState(devices);
  useEffect(() => {
    const instance = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { deviceId: devices.audioinput }, videoCaptureDefaults: { deviceId: devices.videoinput }, audioOutput: { deviceId: devices.audiooutput } });
    let disposed = false;
    setRoom(instance);
    const update = () => { if (!disposed) { setRevision(n => n + 1); callbacks.current.onMute(!instance.localParticipant.isMicrophoneEnabled); } };
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ActiveSpeakersChanged, RoomEvent.AudioPlaybackStatusChanged];
    events.forEach(event => instance.on(event, update));
    instance.on(RoomEvent.ConnectionStateChanged, state => { if (!disposed) setConnection(state); });
    instance.on(RoomEvent.MediaDevicesError, () => { if (!disposed) setError(true); });
    void (async () => {
      try {
        await instance.connect(access.url, access.token);
        if (disposed) { await instance.disconnect(); return; }
        callbacks.current.onJoined();
        // Permission failure must not disconnect the room; controls allow retry/audio-only use.
        const result = await Promise.allSettled([instance.localParticipant.setCameraEnabled(true), instance.localParticipant.setMicrophoneEnabled(true)]);
        if (disposed) { await instance.disconnect(); return; }
        if (!disposed && result.some(value => value.status === 'rejected')) setError(true);
        update();
      } catch { if (!disposed) { setError(true); setConnection(ConnectionState.Disconnected); } }
    })();
    return () => { disposed = true; instance.removeAllListeners(); void instance.disconnect(); };
  }, [access]);
  const act = async (action: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(false); try { await action(); setRevision(n => n + 1); } catch { setError(true); } finally { setBusy(false); } };
  const people = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const connected = connection === ConnectionState.Connected, local = room?.localParticipant;
  return <div className={styles.room}>
    <div className={styles.status} role="status">{t(connection === ConnectionState.Reconnecting || connection === ConnectionState.SignalReconnecting ? 'reconnecting' : connected ? 'live' : connection === ConnectionState.Disconnected ? 'disconnected' : 'connecting')}<span>{people.length} · {t('participants')}</span></div>
    {!room || connection === ConnectionState.Connecting ? <EasyJobLoading /> : <div className={styles.grid}>
      {people.filter(person => person.isScreenShareEnabled).map(person => <ParticipantTile key={`${person.identity}-screen`} person={person} local={person === local} screen />)}
      {people.map(person => <ParticipantTile key={person.identity} person={person} local={person === local} />)}
    </div>}
    {room && [...room.remoteParticipants.values()].flatMap(person => [...person.audioTrackPublications.values()].map(publication => <MediaTrack key={publication.trackSid} publication={publication} local={false} audio />))}
    {error && <p className={styles.error} role="alert">{t(connection === ConnectionState.Disconnected ? 'connectionError' : 'deviceError')}</p>}
    {room && !room.canPlaybackAudio && connected && <Button onClick={() => void act(() => room.startAudio())}><Volume2 size={16} />{t('enableAudio')}</Button>}
    <div className={styles.controls}>
      <Button variant="secondary" disabled={!connected || busy} aria-pressed={!!local?.isMicrophoneEnabled} aria-label={t('microphone')} onClick={() => void act(() => local!.setMicrophoneEnabled(!local?.isMicrophoneEnabled))}>{local?.isMicrophoneEnabled ? <Mic /> : <MicOff />}</Button>
      <Button variant="secondary" disabled={!connected || busy} aria-pressed={!!local?.isCameraEnabled} aria-label={t('camera')} onClick={() => void act(() => local!.setCameraEnabled(!local?.isCameraEnabled))}>{local?.isCameraEnabled ? <Video /> : <VideoOff />}</Button>
      <Button variant="secondary" disabled={!connected || busy} aria-pressed={!!local?.isScreenShareEnabled} aria-label={t('screenShare')} onClick={() => void act(() => local!.setScreenShareEnabled(!local?.isScreenShareEnabled, { audio: true }))}><MonitorUp /></Button>
      <Button variant="secondary" aria-expanded={participantsOpen} aria-label={t('participants')} onClick={() => setParticipantsOpen(value => !value)}><Users /></Button>
      <Button variant="secondary" aria-expanded={settings} aria-label={t('devices')} onClick={() => setSettings(value => !value)}><Settings2 /></Button>
      <Button variant="destructive" onClick={() => { void room?.disconnect(); callbacks.current.onLeave(); }}><PhoneOff size={16} />{t('leave')}</Button>
    </div>
    {settings && <MeetingDevicePicker refresh={connected ? 1 : 0} value={preferences} onChange={next => { void act(async () => { for (const kind of ['audioinput','videoinput','audiooutput'] as const) if (next[kind] !== preferences[kind]) await room?.switchActiveDevice(kind, next[kind] || 'default'); setPreferences(next); }); }} />}
    {participantsOpen && <ul className={styles.people} aria-label={t('participants')}>{people.map(person => <li key={person.identity}>{person.name || person.identity} {person === local && `· ${t('you')}`}</li>)}</ul>}
  </div>;
}
