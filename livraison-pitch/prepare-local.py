import concurrent.futures as cf
import json, os, time
from pathlib import Path
import requests

BASE = Path(__file__).resolve().parent
ROOT = BASE / 'runtime' / 'SadTalker-local'
ROOT.mkdir(parents=True, exist_ok=True)

def fetch_source(item):
    p = ROOT / item['path']
    if p.exists():
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get('https://raw.githubusercontent.com/OpenTalker/SadTalker/main/' + item['path'], timeout=60)
    r.raise_for_status()
    p.write_bytes(r.content)

tree = json.loads((BASE/'research/sadtalker-tree.json').read_text())['tree']
files = [x for x in tree if x['type']=='blob' and (x['path'].startswith(('src/','checkpoints/','gfpgan/')) or x['path'] in ['inference.py','requirements.txt','LICENSE'])]
with cf.ThreadPoolExecutor(max_workers=8) as pool:
    for _ in pool.map(fetch_source, files):
        pass
print('Source ready:', ROOT, flush=True)

def download_ranges(repo, name, size):
    dest = BASE/'models'/name
    if dest.exists() and dest.stat().st_size == size:
        print('Present:', name, flush=True)
        return
    parts = BASE/'models'/(name+'.parts-1m')
    parts.mkdir(parents=True, exist_ok=True)
    url = f'https://huggingface.co/{repo}/resolve/main/{name}'
    response = requests.get(url, headers={'Range':'bytes=0-0'}, stream=True, timeout=30)
    response.raise_for_status()
    response.close()
    block = 1024*1024
    jobs = [(i,start,min(size-1,start+block-1)) for i,start in enumerate(range(0,size,block))]
    started = time.monotonic()
    def piece(job):
        i,start,end = job
        path = parts/f'{i:04d}'
        if path.exists() and path.stat().st_size == end-start+1:
            return path.stat().st_size
        for attempt in range(4):
            try:
                with requests.get(url,headers={'Range':f'bytes={start}-{end}'},stream=True,timeout=(30,90)) as r:
                    r.raise_for_status()
                    if r.status_code != 206 or r.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                        raise ValueError('Invalid range response: '+str(r.headers.get('Content-Range')))
                    with path.with_suffix('.tmp').open('wb') as f:
                        for data in r.iter_content(64*1024):
                            f.write(data)
                if path.with_suffix('.tmp').stat().st_size != end-start+1:
                    raise ValueError('Incomplete piece')
                path.with_suffix('.tmp').replace(path)
                return end-start+1
            except Exception:
                if attempt==3: raise
                time.sleep(2+attempt*3)
    done=0
    with cf.ThreadPoolExecutor(max_workers=16) as pool:
        for fut in cf.as_completed([pool.submit(piece,j) for j in jobs]):
            done += fut.result()
            print(f'{name}: {done/size:.0%}, {done/1048576:.1f} MiB, elapsed {time.monotonic()-started:.0f}s',flush=True)
    with dest.with_suffix(dest.suffix+'.partial').open('wb') as out:
        for i,_,_ in jobs:
            with (parts/f'{i:04d}').open('rb') as src:
                while data:=src.read(1024*1024): out.write(data)
    dest.with_suffix(dest.suffix+'.partial').replace(dest)
    print('Model ready:', dest, flush=True)

download_ranges('vinthony/SadTalker-V002rc','SadTalker_V0.0.2_256.safetensors',725066984)
download_ranges('vinthony/SadTalker-V002rc','mapping_00109-model.pth.tar',155779231)

