import concurrent.futures as cf
from pathlib import Path
import requests,time
base=Path(__file__).resolve().parent/'runtime/SadTalker-local/gfpgan/weights'
base.mkdir(parents=True,exist_ok=True)
def download(name,size):
    target=base/name
    if target.exists() and target.stat().st_size==size: return
    url='https://github.com/xinntao/facexlib/releases/download/v0.1.0/'+name
    if name=='alignment_WFLW_4HG.pth':
        url='https://huggingface.co/TonyD2046/sadtalker-01/resolve/c0d445c08b20fdae5d0335a1e2ecd1cc16df7f3a/hub/alignment_WFLW_4HG.pth'
    parts=base/(name+'.parts');parts.mkdir(exist_ok=True)
    jobs=[(i,s,min(s+1048576-1,size-1)) for i,s in enumerate(range(0,size,1048576))]
    def get(job):
        i,s,e=job;p=parts/str(i)
        if p.exists() and p.stat().st_size==e-s+1:return
        for attempt in range(4):
            try:
                r=requests.get(url,headers={'Range':f'bytes={s}-{e}'},timeout=90)
                r.raise_for_status()
                if r.status_code!=206 or len(r.content)!=e-s+1:raise ValueError('Invalid partial download')
                p.write_bytes(r.content);return
            except Exception:
                if attempt==3:raise
                time.sleep(3)
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for i,_ in enumerate(pool.map(get,jobs)):
            if i%20==0:print(name,round((i+1)/len(jobs)*100),'%',flush=True)
    with target.open('wb') as out:
        for i,_,_ in jobs:out.write((parts/str(i)).read_bytes())
    if name=='alignment_WFLW_4HG.pth':
        import hashlib
        actual=hashlib.sha256(target.read_bytes()).hexdigest()
        if actual!='bbfd137307a4c7debd5c283b9b0ce539466cee417ac0a155e184d857f9f2899c':
            raise RuntimeError('Landmark model checksum mismatch')
    print('Ready',name,flush=True)
download('detection_mobilenet0.25_Final.pth',1789735)
download('alignment_WFLW_4HG.pth',193670248)
