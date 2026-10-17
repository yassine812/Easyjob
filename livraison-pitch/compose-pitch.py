"""Assemble the real animated frames, speech and timed French captions."""
import argparse,bisect,json,math,textwrap,wave
from pathlib import Path
from fractions import Fraction
import av,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont

BASE=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--name',default='pitch');p.add_argument('--output',required=True);p.add_argument('--preview-only',action='store_true')
a=p.parse_args();work=BASE/'renders'/a.name
meta=json.loads((work/'render.json').read_text())
frames=sorted((work/'frames').glob('*.png'));indices=[int(x.stem) for x in frames]
total=meta['frames'];fps=25
if not frames or indices[0]!=0 or indices[-1]<total-1:raise RuntimeError('Face render is incomplete')
portrait=cv2.imread(meta['portrait'])
H,W=720,1280
portrait=cv2.resize(portrait,(560,560),interpolation=cv2.INTER_AREA)
orig=cv2.imread(meta['portrait']);scale=560/orig.shape[1]
_,crop,quad=meta['crop_info'];cx,cy,_,_=crop;lx,ly,rx,ry=quad
x1,y1,x2,y2=[round(v*scale) for v in (cx+int(lx),cy+int(ly),cx+int(rx),cy+int(ry))]
text=(BASE/'easyjob-pitch-fr.txt').read_text(encoding='utf-8-sig').strip()
rows=[(float(t),int(pos),int(n)) for t,pos,n in (x.split('\t') for x in (BASE/'narration-timing-16k.tsv').read_text().splitlines())]
def time_of(fragment):
    pos=text.index(fragment)
    return next(t for t,i,n in rows if i>=pos)
cards=[
 (0,'Le recrutement,\nplus clair.', ['Une plateforme pour les candidats','et les recruteurs.']),
 (time_of('Notre point de départ'),'Le problème',['Des démarches dispersées.','Des candidatures difficiles à suivre.','Du temps perdu à trier les profils.']),
 (time_of('EasyJob réunit'),'La solution',['Préparer son CV et trouver des offres.','Suivre ses candidatures.','Gérer le recrutement et les entretiens.']),
 (time_of('L’innovation'),'L’innovation',['Un matching explicable.','Des compétences et des écarts visibles.','La décision reste humaine.']),
 (time_of('Nous proposons'),'Trois langues',['Français · English · العربية','Une expérience pensée pour la région.']),
 (time_of('Notre marché'),'Le marché',['La Tunisie pour commencer.','Candidats, startups et PME.','Accès gratuit et abonnements avancés.']),
 (time_of('Nous souhaitons'),'Le potentiel de croissance',['Valider les usages et la disposition à payer.','Suivre la rétention et les abonnements.','Envisager ensuite le Maghreb.']),
 (time_of('EasyJob dispose'),'Le porteur du projet',['Un MVP démontrable.','Yassine Zerni : pilotage et développement.','Renforcer les compétences RH et commerciales.']),
 (time_of('Notre ambition'),'L’humain au centre.',['Un parcours vers l’emploi plus clair.','Un recrutement plus simple.','Merci.'])]
# Avoid scripts requiring shaping in the default video renderer.
cards[4]=(cards[4][0],cards[4][1],['Français · Anglais · Arabe','Une expérience pensée pour la région.'])
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',size)
captions=[];chunk=[]
for row in rows:
    chunk.append(row)
    start=chunk[0][1];end=row[1]+row[2]
    if len(text[start:end])>=66 or (text[end:end+1] in '.!?' and len(chunk)>=4):
        captions.append([chunk[0][0],text[start:end]+(text[end:end+1] if text[end:end+1] in '.!?,;' else '')]);chunk=[]
if chunk:captions.append([chunk[0][0],text[chunk[0][1]:chunk[-1][1]+chunk[-1][2]]])
cap_times=[x[0] for x in captions]
with wave.open(meta['audio']) as w:duration=w.getnframes()/w.getframerate()
captions=[item for item in captions if item[0]<duration]
cap_times=[x[0] for x in captions]
def stamp(t):
    ms=round(t*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
(BASE/'easyjob-presentation-fr.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(t)} --> {stamp(captions[i+1][0] if i+1<len(captions) else duration)}\n{s}' for i,(t,s) in enumerate(captions)),encoding='utf-8')
backgrounds=[]
for _,title,bullets in cards:
    im=Image.new('RGB',(W,H),(12,18,33));d=ImageDraw.Draw(im)
    d.rounded_rectangle((38,38,602,606),20,fill=(32,41,62),outline=(67,78,108),width=2)
    d.text((652,48),'EASYJOB',font=font(27,True),fill=(163,174,255))
    d.text((652,115),title,font=font(38,True),fill=(245,246,255),spacing=9)
    d.line((652,242,726,242),fill=(130,144,255),width=4)
    yy=280
    for bullet in bullets:
        for line in textwrap.wrap(bullet,width=39):
            d.text((652,yy),line,font=font(24),fill=(197,206,226));yy+=37
        yy+=18
    d.text((48,615),'Yassine Zerni',font=font(22,True),fill=(239,242,251))
    d.text((220,618),'Porteur du projet EasyJob',font=font(18),fill=(156,170,197))
    d.text((652,620),'Avatar et voix de synthèse',font=font(14),fill=(156,170,197))
    backgrounds.append(im)
last_pair=None;cache=None
def animated_crop(i):
    global last_pair,cache
    left=max(0,bisect.bisect_right(indices,i)-1);right=min(left+1,len(indices)-1)
    if (left,right)!=last_pair:
        aa=cv2.imread(str(frames[left]));bb=cv2.imread(str(frames[right]))
        flow=cv2.calcOpticalFlowFarneback(cv2.cvtColor(aa,cv2.COLOR_BGR2GRAY),cv2.cvtColor(bb,cv2.COLOR_BGR2GRAY),None,.5,3,15,3,5,1.2,0)
        back=cv2.calcOpticalFlowFarneback(cv2.cvtColor(bb,cv2.COLOR_BGR2GRAY),cv2.cvtColor(aa,cv2.COLOR_BGR2GRAY),None,.5,3,15,3,5,1.2,0)
        grid=np.stack(np.meshgrid(np.arange(aa.shape[1]),np.arange(aa.shape[0])),axis=-1).astype(np.float32)
        cache=(aa,bb,flow,back,grid);last_pair=(left,right)
    aa,bb,flow,back,grid=cache
    if indices[right]==indices[left]:return aa
    t=(i-indices[left])/(indices[right]-indices[left])
    if t==0:return aa
    wa=cv2.remap(aa,grid-t*flow,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    wb=cv2.remap(bb,grid-(1-t)*back,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(wa,1-t,wb,t,0)
def compose(i):
    t=i/fps;card=max(0,bisect.bisect_right([x[0] for x in cards],t)-1)
    im=backgrounds[card].copy();face=animated_crop(i)
    patch=cv2.resize(face,(x2-x1,y2-y1),interpolation=cv2.INTER_CUBIC)
    mask=np.ones(patch.shape[:2],dtype=np.uint8)*255
    mask[:3,:]=0;mask[-3:,:]=0;mask[:,:3]=0;mask[:,-3:]=0
    person=cv2.seamlessClone(patch,portrait,mask,((x1+x2)//2,(y1+y2)//2),cv2.NORMAL_CLONE)
    im.paste(Image.fromarray(cv2.cvtColor(person,cv2.COLOR_BGR2RGB)),(40,40))
    d=ImageDraw.Draw(im)
    if captions and t>=captions[0][0]:
        cap=captions[max(0,bisect.bisect_right(cap_times,t)-1)][1]
        lines=textwrap.wrap(cap,width=87)
        for n,line in enumerate(lines[:2]):
            d.text((W//2,663+n*27),line,font=font(22),anchor='mm',fill=(239,242,251))
    return np.asarray(im)
preview=compose(min(25,total-1));Image.fromarray(preview).save(work/'composition-preview.jpg')
if a.preview_only:raise SystemExit('Preview saved')

output=Path(a.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
with av.open(str(output),'w') as out, av.open(meta['audio']) as audio_in:
    vs=out.add_stream('libx264',rate=fps);vs.width=W;vs.height=H;vs.pix_fmt='yuv420p';vs.options={'crf':'20','preset':'veryfast'}
    aus=out.add_stream('aac',rate=48000);aus.layout='mono';aus.bit_rate=128000
    resampler=av.AudioResampler(format='fltp',layout='mono',rate=48000)
    def audio_frames():
        for f in audio_in.decode(audio=0):
            for g in resampler.resample(f):yield g
        for g in resampler.resample(None):yield g
    agen=iter(audio_frames());af=next(agen,None)
    for i in range(total):
        frame=av.VideoFrame.from_ndarray(compose(i),format='rgb24');frame.pts=i;frame.time_base=Fraction(1,fps)
        for packet in vs.encode(frame):out.mux(packet)
        while af is not None and float(af.pts*af.time_base)<=i/fps:
            for packet in aus.encode(af):out.mux(packet)
            af=next(agen,None)
        if i%125==0:print(f'Montage {i}/{total}',flush=True)
    while af is not None:
        for packet in aus.encode(af):out.mux(packet)
        af=next(agen,None)
    for packet in vs.encode():out.mux(packet)
    for packet in aus.encode():out.mux(packet)
print('Saved',output,flush=True)
