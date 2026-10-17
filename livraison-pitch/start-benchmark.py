from pathlib import Path
import hashlib,json,subprocess,time
base=Path(__file__).resolve().parent
needed=[base/'models/SadTalker_V0.0.2_256.safetensors',base/'runtime/SadTalker-local/gfpgan/weights/alignment_WFLW_4HG.pth']
print('Waiting for downloaded model files',flush=True)
while not all(p.exists() and p.stat().st_size==size for p,size in zip(needed,[725066984,193670248])):time.sleep(10)
manifest=json.loads((base/'research/model-hashes.json').read_text())
with needed[0].open('rb') as f:actual=hashlib.file_digest(f,'sha256').hexdigest()
if actual!=manifest[needed[0].name]['oid']:raise RuntimeError('Main model checksum mismatch')
print('Model checksum verified; starting real face generation',flush=True)
subprocess.run([str(base/'.venv/Scripts/python.exe'),'-u',str(base/'render-local.py'),'--audio',str(base/'test-voix-6s.wav'),'--name','bench256','--stride','25','--max-frames','4'],check=True)
