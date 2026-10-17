from huggingface_hub import hf_hub_download
from pathlib import Path
base=Path('livraison-pitch/models').resolve()
for f in ['SadTalker_V0.0.2_256.safetensors','mapping_00229-model.pth.tar']:
 print('Downloading',f,flush=True)
 print(hf_hub_download('vinthony/SadTalker-V002rc',f,local_dir=base),flush=True)
