'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { useHiringText } from '@/lib/i18n/hiring';
export function MeetingTranscription({id,ready,muted,locale='auto'}:{id:string;ready:boolean;muted:boolean;locale?:string}){
  const t=useHiringText(),[enabled,setEnabled]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    if(!enabled||!ready||muted)return;
    let disposed=false,stream:MediaStream|null=null,recorder:MediaRecorder|null=null,timer:ReturnType<typeof setTimeout>|undefined;
    const start=async()=>{
      try{
        if(!navigator.mediaDevices||!window.MediaRecorder)throw new Error('Media recording unavailable');
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
        if(disposed){stream.getTracks().forEach(track=>track.stop());return;}
        const record=()=>{
          if(disposed||!stream)return;
          const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
          if(!mime)throw new Error('Unsupported audio recorder');
          recorder=new MediaRecorder(stream,{mimeType:mime});const chunks:Blob[]=[];
          recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
          recorder.onstop=async()=>{if(disposed)return;const file=new Blob(chunks,{type:mime.split(';')[0]});const data=new FormData();data.append('file',file,'audio.webm');try{await api.post(`/meetings/${id}/audio${['fr','en','ar'].includes(locale)?`?locale=${locale}`:''}`,data);if(!disposed)record();}catch{setError(true);setEnabled(false);}};
          recorder.start();timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},15000);
        };record();
      }catch{setError(true);setEnabled(false);}
    };void start();
    return()=>{disposed=true;clearTimeout(timer);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());};
  },[enabled,ready,muted,id,locale]);
  return <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"><p role="status">{t(!ready?'waitingConsent':enabled&&!muted?'transcriptionActive':'transcriptionPaused')}</p><Button size="sm" variant="outline" disabled={!ready} onClick={()=>{setError(false);setEnabled(v=>!v);}}>{t(enabled?'stopTranscription':'startTranscription')}</Button>{error&&<p role="alert" className="text-destructive">{t('transcriptionError')}</p>}</div>;
}
