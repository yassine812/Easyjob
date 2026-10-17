import json,time,os
from pathlib import Path
from faster_whisper import WhisperModel
B=Path(__file__).resolve().parent
root=Path('C:/Users/Yassine/.cache/huggingface/hub/models--Systran--faster-whisper-medium/snapshots')
paths=[p for p in root.iterdir() if (p/'model.bin').exists()]
print('Loading cached transcription model',flush=True)
m=WhisperModel(str(paths[0]),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
segs,info=m.transcribe(r'C:\Users\Yassine\Downloads\WhatsApp Video 2026-10-11 at 10.57.36 AM.mp4',language='fr',beam_size=1,word_timestamps=True,vad_filter=True,initial_prompt='EasyJob. Yassine. Recrutement, candidats, Tunisie, startups, PME, matching explicable, MVP.')
out=[]
for s in segs:
 out.append({'start':s.start,'end':s.end,'text':s.text,'words':[{'start':w.start,'end':w.end,'word':w.word} for w in s.words]})
 (B/'real-transcript.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
 print(f'{s.start:.1f} {s.end:.1f} {s.text}',flush=True)
print('TRANSCRIPTION COMPLETE',flush=True)
