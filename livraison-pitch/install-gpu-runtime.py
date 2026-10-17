"""Download compatible PyPI wheels, verify their published hashes, install in the isolated venv."""
from pathlib import Path
import requests,concurrent.futures as cf,hashlib,subprocess
from packaging.tags import sys_tags
from packaging.utils import parse_wheel_filename
base=Path(__file__).resolve().parent;dest=base/'runtime/wheels';dest.mkdir(parents=True,exist_ok=True)
valid=set(sys_tags())
for name in ['onnx','onnxruntime-directml','ml-dtypes']:
    j=requests.get('https://pypi.org/pypi/'+name+'/json',timeout=30).json()
    candidates=[f for f in j['urls'] if f['filename'].endswith('.whl') and parse_wheel_filename(f['filename'])[3]&valid]
    if not candidates:raise RuntimeError('No compatible wheel for '+name)
    f=candidates[0];target=dest/f['filename'];size=f['size']
    print('Preparing',f['filename'],size,flush=True)
    if not target.exists():
        def get(start):
            end=min(size-1,start+1048575)
            r=requests.get(f['url'],headers={'Range':f'bytes={start}-{end}'},timeout=90);r.raise_for_status()
            if r.status_code!=206 or len(r.content)!=end-start+1:raise RuntimeError('Invalid wheel download')
            return start,r.content
        with target.open('wb') as out,cf.ThreadPoolExecutor(max_workers=8) as pool:
            for start,data in pool.map(get,range(0,size,1048576)):
                out.seek(start);out.write(data)
    with target.open('rb') as inp:actual=hashlib.file_digest(inp,'sha256').hexdigest()
    if actual!=f['digests']['sha256']:raise RuntimeError('Wheel checksum mismatch')
    subprocess.run([str(base/'.venv/Scripts/python.exe'),'-m','pip','install','--no-deps',str(target)],check=True)
