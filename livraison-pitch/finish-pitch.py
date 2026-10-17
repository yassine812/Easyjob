"""Produce and validate the final pitch, keeping stage logs and resumable frames."""
import json,subprocess,sys,time,shutil
from pathlib import Path
B=Path(__file__).resolve().parent
name='pitch-split128'
work=B/'renders'/name
work.mkdir(parents=True,exist_ok=True)
if not (work/'source.json').exists():
    shutil.copy2(B/'renders/bench256/source.json',work/'source.json')
output=B/'easyjob-presentation-fr.mp4'
stages=[
 ('animation',[sys.executable,'-u',str(B/'render-local.py'),'--audio',str(B/'easyjob-pitch-fr-16k.wav'),'--name',name,'--stride','3','--render-size','128','--split-gpu']),
 ('montage',[sys.executable,'-u',str(B/'compose-pitch.py'),'--name',name,'--output',str(output)]),
 ('verification',[sys.executable,'-u',str(B/'verifier-video.py'),str(output)])
started=time.time()
for stage,cmd in stages:
    (work/'pipeline.json').write_text(json.dumps({'stage':stage,'started':started,'updated':time.time()}))
    print('STAGE',stage,flush=True)
    with (work/(stage+'.log')).open('a',encoding='utf8') as log:
        child=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8',errors='replace')
        for line in child.stdout:
            log.write(line);log.flush();print(line,end='',flush=True)
        code=child.wait()
    if code:raise SystemExit(f'{stage} failed with exit code {code}')
(work/'pipeline.json').write_text(json.dumps({'stage':'complete','started':started,'finished':time.time(),'file':str(output)}))
print('COMPLETE',output,flush=True)
