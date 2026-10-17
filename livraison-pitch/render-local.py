"""Run SadTalker locally, in separate stages, with resumable frame output."""
import argparse,gc,json,os,sys,time
from pathlib import Path
import numpy as np

BASE=Path(__file__).resolve().parent
ROOT=BASE/'runtime/SadTalker-local'
sys.path.insert(0,str(ROOT));os.chdir(ROOT)
for k,v in [('float',float),('int',int),('complex',complex),('bool',np.bool_),('VisibleDeprecationWarning',DeprecationWarning)]:
    if k not in np.__dict__:setattr(np,k,v)
from PIL import Image
if not hasattr(Image,'ANTIALIAS'):Image.ANTIALIAS=Image.Resampling.LANCZOS
import torch
torch.set_num_threads(4)
torch.set_num_interop_threads(2)
torch.manual_seed(7)
import random
random.seed(7)
np.random.seed(7)

p=argparse.ArgumentParser()
p.add_argument('--audio',required=True)
p.add_argument('--name',default='pitch')
p.add_argument('--stride',type=int,default=2)
p.add_argument('--max-frames',type=int,default=0)
p.add_argument('--render-size',type=int,default=256)
p.add_argument('--directml',action='store_true')
p.add_argument('--split-gpu',action='store_true')
args=p.parse_args()
AUDIO=Path(args.audio).resolve()
PHOTO=Path(r'C:\Users\Yassine\Downloads\profile.jpg')
OUT=BASE/'renders'/args.name
OUT.mkdir(parents=True,exist_ok=True)
FRAMES=OUT/'frames';FRAMES.mkdir(exist_ok=True)

from src.utils.init_path import init_path
paths=init_path(str(BASE/'models'),str(ROOT/'src/config'),256,False,'full')
metadata_path=OUT/'source.json'
if metadata_path.exists():
    meta=json.loads(metadata_path.read_text())
else:
    from src.utils.preprocess import CropAndExtract
    print('Extracting face and landmarks',flush=True)
    with torch.inference_mode():
        pre=CropAndExtract(paths,'cpu')
        coeff,crop,info=pre.generate(str(PHOTO),str(OUT),'full',source_image_flag=True,pic_size=256)
    if coeff is None:raise RuntimeError('No face detected')
    meta={'coeff':coeff,'crop':crop,'info':info}
    metadata_path.write_text(json.dumps(meta,default=lambda x:x.tolist()),encoding='utf8')
    del pre;gc.collect()

coeff_meta=OUT/'audio.json'
if coeff_meta.exists():
    audio_coeff=json.loads(coeff_meta.read_text())['coeff']
else:
    from src.test_audio2coeff import Audio2Coeff
    from src.generate_batch import get_data
    print('Generating speech expressions',flush=True)
    with torch.inference_mode():
        a2c=Audio2Coeff(paths,'cpu')
        batch=get_data(meta['coeff'],str(AUDIO),'cpu',None,still=True)
        audio_coeff=a2c.generate(batch,str(OUT),0)
    coeff_meta.write_text(json.dumps({'coeff':audio_coeff}),encoding='utf8')
    del a2c,batch;gc.collect()

from src.facerender.animate import AnimateFromCoeff
from src.generate_facerender_batch import get_facerender_data
from src.facerender.modules.make_animation import keypoint_transformation
import cv2
while not Path(paths['mappingnet_checkpoint']).is_file():
    print('Waiting for the final renderer checkpoint download',flush=True)
    time.sleep(15)
print('Loading face renderer',flush=True)
with torch.inference_mode():
    animator=AnimateFromCoeff(paths,'cpu')
    if args.split_gpu:
        from dml_split import install
        install(animator.generator,args.render_size)
    elif args.directml:
        from dml_decoder import replace_decoder
        replace_decoder(animator.generator,args.render_size)
    data=get_facerender_data(audio_coeff,meta['crop'],meta['coeff'],str(AUDIO),1,expression_scale=1.0,still_mode=True,preprocess='full',size=256)
    source_full=data['source_image']
    canonical=animator.kp_extractor(source_full)
    source=torch.nn.functional.interpolate(source_full,size=(args.render_size,args.render_size),mode='bilinear',align_corners=False) if args.render_size!=256 else source_full
    source_pose=animator.mapping(data['source_semantics'])
    kp_source=keypoint_transformation(canonical,source_pose)
    total=data['frame_num']
    indices=list(range(0,total,args.stride))
    if indices[-1]!=total-1:indices.append(total-1)
    if args.max_frames:indices=indices[:args.max_frames]
    (OUT/'render.json').write_text(json.dumps({'fps':25,'frames':total,'stride':args.stride,'audio':str(AUDIO),'portrait':str(PHOTO),'crop_info':meta['info']}),encoding='utf8')
    start=time.monotonic();done=0
    for i in indices:
        path=FRAMES/f'{i:06d}.png'
        if path.exists():continue
        driving=animator.mapping(data['target_semantics_list'][:,i])
        kp_driving=keypoint_transformation(canonical,driving)
        result=animator.generator(source,kp_source=kp_source,kp_driving=kp_driving)['prediction']
        rgb=np.rint(np.clip(result[0].permute(1,2,0).cpu().numpy(),0,1)*255).astype(np.uint8)
        cv2.imwrite(str(path),cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR))
        done+=1
        elapsed=time.monotonic()-start
        status={'index':i,'total':total,'new_frames':done,'elapsed':round(elapsed,1),'seconds_per_frame':round(elapsed/done,2)}
        (OUT/'status.json').write_text(json.dumps(status),encoding='utf8')
        print(json.dumps(status),flush=True)
print('Face rendering finished',flush=True)
