"""Edit the founder recording with genuine recorded EasyJob interactions."""
import argparse,bisect,json,math,textwrap,time
from pathlib import Path
from fractions import Fraction
import av,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
B=Path(__file__).resolve().parent
SOURCE=Path(r'C:\Users\Yassine\Downloads\WhatsApp Video 2026-10-11 at 10.57.36 AM.mp4')
DEMO=Path(r'C:\Users\Yassine\Downloads\easyjob-tutoriel-dark.mp4')
p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');a=p.parse_args()
plan=json.loads((B/'real-edit-plan.json').read_text(encoding='utf8'))
segments=json.loads((B/'real-transcript.json').read_text(encoding='utf8'))
START=plan.get('trim_start',0);END=plan.get('trim_end',138.6);DURATION=END-START
W,H,FPS=1280,720,30
def font(s,b=False):return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if b else 'C:/Windows/Fonts/segoeui.ttf',s)
F28,F22,F18=font(28,True),font(22,True),font(18)
caps=[];chunk=[]
for seg in segments:
 for word in seg['words']:
  chunk.append(word)
  sentence=''.join(w['word'] for w in chunk).strip().replace('Easy Job','EasyJob').replace('Easyjob','EasyJob')
  if len(sentence)>=63 or (word['word'].strip().endswith(('.', '?', '!')) and len(sentence)>15):
   caps.append((max(0,chunk[0]['start']-START),min(DURATION,chunk[-1]['end']-START+.12),sentence));chunk=[]
if chunk:caps.append((max(0,chunk[0]['start']-START),min(DURATION,chunk[-1]['end']-START+.12),''.join(w['word'] for w in chunk).strip()))
caps=[c for c in caps if c[1]>c[0]]
corrections={"je m'appelle EasyJob":"je m'appelle Yassine","entre-loi":"emploi","candidateurs":"candidatures","disparusés":"dispersés","un même plateforme":"une même plateforme","rassemble ses étapes":"rassemble ces étapes","comptes d'étude":"candidatures","rétabli":"recrutement","faisant à partir":"faisant apparaître","à profondir":"à approfondir"}
fixed=[]
corrections.update({'comme dit, que':'tandis que','reste humain.':'reste humaine.','dans un litre.':'dans notre région.'})
corrections.update({'les stades':'les startups','les PM,':'les PME,','apportements':'abonnements','priorité et de':'priorité est de'})
corrections.update({'de ma grève':'du Maghreb','utilisation régulier':'utilisation régulière','Nous souhaitons notamment':'Nous suivrons notamment'})
corrections.update({"la recherche, l'emploi":"la recherche d'emploi","l'efficacité plus efficace":"le recrutement plus efficace","les mains au centre":"l'humain au centre"})
for i,(s,e,txt) in enumerate(caps):
 for old,new in corrections.items():txt=txt.replace(old,new)
 txt=txt.replace('réponses pour les entreprises.','réponses. Pour les entreprises,').replace('le modèle économique est','le modèle économique').replace("combiné à l'accès gratuit",'combine un accès gratuit').replace('avancées pour grandir','avancées. Pour grandir,').replace("et de tester la solution auprès de l'utilisateur réel.","est de tester la solution auprès d'utilisateurs réels.")
 if i+1<len(caps):e=min(e,caps[i+1][0])
 fixed.append((s,e,txt))
caps=fixed
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
(B/'easyjob-pitch-final-fr.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(s)} --> {stamp(e)}\n{txt}' for i,(s,e,txt) in enumerate(caps)),encoding='utf8')
class Reader:
 def __init__(self,path,rotate=False):
  self.c=av.open(str(path));self.rotate=rotate;self.iterator=None;self.next=None;self.last=None;self.t=-1
 def get(self,t):
  if self.iterator is None or t<self.t-.01 or t>self.t+2:
   self.c.seek(max(0,int(t*1e6)));self.iterator=self.c.decode(video=0);self.next=next(self.iterator,None);self.last=None
  while self.next is not None and self.next.time<=t+.0001:
   self.last=self.next;self.next=next(self.iterator,None)
  f=self.last or self.next
  if f is None:raise RuntimeError('Missing source frame')
  im=f.to_ndarray(format='rgb24')
  if self.rotate:im=cv2.rotate(im,cv2.ROTATE_180)
  self.t=t;return im
presenter=Reader(SOURCE,True);demo=Reader(DEMO)
capstarts=[c[0] for c in caps]
overlays={}
def overlay_for(t,mode,title):
 ci=bisect.bisect_right(capstarts,t)-1
 cap=caps[ci][2] if ci>=0 and t<=caps[ci][1] else ''
 key=(mode,title,cap,t<8)
 if key not in overlays:
  ov=Image.new('RGBA',(W,H));d=ImageDraw.Draw(ov)
  d.rounded_rectangle((24,20,205,67),12,fill=(13,20,37,235))
  d.text((42,29),'EasyJob',font=F28,fill=(177,187,255))
  tw=d.textbbox((0,0),title,font=F22)[2]
  d.rounded_rectangle((W-tw-55,22,W-24,65),10,fill=(13,20,37,225))
  d.text((W-tw-39,31),title,font=F22,fill='white')
  if t<8:
   d.rounded_rectangle((24,513,450,593),12,fill=(13,20,37,225))
   d.text((42,525),'Yassine',font=F28,fill='white')
   d.text((42,562),'Porteur du projet EasyJob',font=F18,fill=(209,215,233))
  if mode=='demo':d.rounded_rectangle((972,476,1258,641),10,outline=(173,185,255),width=3)
  if cap:
   lines=textwrap.wrap(cap,65)
   boxh=34*len(lines)+18;top=H-boxh-15
   widths=[d.textbbox((0,0),line,font=F28)[2] for line in lines]
   half=max(widths)/2+22
   d.rounded_rectangle((W/2-half,top,W/2+half,H-15),10,fill=(7,12,24,235))
   for n,line in enumerate(lines):d.text((W/2,top+9+34*n),line,font=F28,fill='white',anchor='mt')
  overlays[key]=(ov,ov.getchannel('A'))
 return overlays[key]
def compose(t):
 source=presenter.get(t+START)
 clip=next((x for x in plan['clips'] if x['start']<=t+START<x['end']),None)
 title=next((x['title'] for x in reversed(plan['chapters']) if x['start']<=t+START),'Présentation')
 if clip:
  dt=clip['source_start']+(t+START-clip['start'])*clip.get('speed',1)
  canvas=cv2.resize(demo.get(dt),(W,H),interpolation=cv2.INTER_AREA)
  # Keep the presenter visible without replacing their appearance or voice.
  canvas[480:637,976:1254]=cv2.resize(source,(278,157),interpolation=cv2.INTER_AREA)
  mode='demo'
 else:
  canvas=cv2.resize(source,(W,H),interpolation=cv2.INTER_CUBIC);mode='presenter'
 ov,mask=overlay_for(t,mode,title)
 im=Image.fromarray(canvas);im.paste(ov,(0,0),mask)
 return np.asarray(im)
for t in [3,35,45,55,70,95,120,134]:
 if t<DURATION:Image.fromarray(compose(t)).save(B/f'final-preview-{t:03d}.jpg')
if a.preview:
 print('Previews ready');raise SystemExit(0)
output=B/'easyjob-pitch-final-fr.mp4'
print('Encoding',round(DURATION,2),'seconds',flush=True)
# Decode the original voice once, trim to the same interval, and normalize gently.
audio=[]
with av.open(str(SOURCE)) as c:
 res=av.AudioResampler(format='fltp',layout='mono',rate=48000)
 for f in c.decode(audio=0):
  for g in res.resample(f):audio.append(g.to_ndarray().reshape(-1))
 for g in res.resample(None):audio.append(g.to_ndarray().reshape(-1))
pcm=np.concatenate(audio)[round(START*48000):round(END*48000)]
peak=float(np.max(np.abs(pcm)));gain=min(2.0,.92/max(peak,.001));pcm=(pcm*gain).astype(np.float32)
with av.open(str(output),'w') as c:
 v=c.add_stream('libx264',rate=FPS);v.width=W;v.height=H;v.pix_fmt='yuv420p';v.options={'crf':'20','preset':'veryfast','threads':'3'}
 au=c.add_stream('aac',rate=48000);au.layout='mono';au.bit_rate=160000
 pos=0;started=time.monotonic();total=math.ceil(DURATION*FPS)
 for i in range(total):
  f=av.VideoFrame.from_ndarray(compose(i/FPS),format='rgb24');f.pts=i;f.time_base=Fraction(1,FPS)
  for packet in v.encode(f):c.mux(packet)
  while pos<len(pcm) and pos/48000<=(i+1)/FPS:
   samples=pcm[pos:pos+1024];af=av.AudioFrame.from_ndarray(samples.reshape(1,-1),format='fltp',layout='mono');af.sample_rate=48000;af.pts=pos;af.time_base=Fraction(1,48000)
   for packet in au.encode(af):c.mux(packet)
   pos+=len(samples)
  if i%300==0:
   state={'frame':i,'total':total,'elapsed':round(time.monotonic()-started,1)}
   (B/'real-edit-progress.json').write_text(json.dumps(state));print(state,flush=True)
 for packet in v.encode():c.mux(packet)
 for packet in au.encode():c.mux(packet)
print('SAVED',output,flush=True)
