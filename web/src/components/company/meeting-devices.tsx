'use client';

import { useState } from 'react';
import { Camera, Mic, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EasyJobLoader } from '@/components/ui/easyjob-loader';
import { useMeetingText } from './meeting-copy';
import { MeetingDevicePicker, type DevicePreferences } from './native-meeting-room';
import styles from './meeting-room.module.css';

/** Device pre-join only asks for browser permission; it does not run local tests. */
export function MeetingDevices({ devices = {}, onDevicesChange = () => undefined }: { devices?: DevicePreferences; onDevicesChange?: (value: DevicePreferences) => void }) {
  const t = useMeetingText();
  const [state, setState] = useState<'idle' | 'pending' | 'authorized' | 'error'>('idle');

  const authorize = async () => {
    setState('pending');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      media.getTracks().forEach(track => track.stop());
      setState('authorized');
    } catch {
      setState('error');
    }
  };

  return <div>
    <div className={styles.preview}>
      <div className={styles.previewEmpty}>
        {state === 'pending' ? <EasyJobLoader width={160} height={55} /> : <>
          <Video />
          <p>{t(state === 'authorized' ? 'deviceAuthorized' : 'devicePermissionHelp')}</p>
          {state !== 'authorized' && <Button onClick={() => void authorize()}><Camera className="size-4" />{t('requestDevicePermission')}</Button>}
        </>}
      </div>
    </div>
    {state === 'error' && <p role="alert" className="mt-3 text-sm text-destructive">{t('devicePermissionError')}</p>}
    <MeetingDevicePicker refresh={state === 'authorized' ? 1 : 0} value={devices} onChange={onDevicesChange} />
    <div className={styles.devices}>
      <div className={styles.device}><Camera /><div>{t('camera')}<small>{state === 'authorized' ? t('permissionGranted') : t('permissionRequired')}</small></div></div>
      <div className={styles.device}><Mic /><div>{t('microphone')}<small>{state === 'authorized' ? t('permissionGranted') : t('permissionRequired')}</small></div></div>
    </div>
  </div>;
}
