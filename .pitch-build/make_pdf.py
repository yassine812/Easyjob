import json,os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from PIL import Image
B=Path(__file__).resolve().parent
OUT=B.parent/'output/pdf/EasyJob-Pitch-Deck-FR.pdf'
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold','C:/Windows/Fonts/arialbd.ttf'))
slides=json.loads((B/'layout.json').read_text(encoding='utf8'))
c=canvas.Canvas(str(OUT),pagesize=(960,540),pageCompression=1)
c.setTitle('EasyJob - Pitch Deck');c.setAuthor('EasyJob');c.setSubject('Candidature au Label Startup, octobre 2026')
warnings=[]
def wrap(text,font,size,width):
 lines=[]
 for para in text.split('\n'):
  line=''
  for word in para.split():
   trial=(line+' '+word).strip()
   if line and pdfmetrics.stringWidth(trial,font,size)>width:
    lines.append(line);line=word
   else:line=trial
  lines.append(line)
 return lines
for i,slide in enumerate(slides,1):
 c.setFillColor(HexColor('#101727'));c.rect(0,0,960,540,stroke=0,fill=1)
 for e in slide:
  x,y,w,h=[e[k]*.75 for k in ['x','y','w','h']]
  if e['kind']=='image':
   with Image.open(e['path']) as im:iw,ih=im.size
   scale=min(w/iw,h/ih);dw,dh=iw*scale,ih*scale
   c.drawImage(e['path'],x+(w-dw)/2,540-y-(h+dh)/2,dw,dh,mask='auto')
  else:
   font='Arial-Bold' if e['bold'] else 'Arial';size=e['size']*.75
   lines=wrap(e['text'],font,size,w);lead=size*1.19
   height=pdfmetrics.getAscent(font)*size/1000+(len(lines)-1)*lead
   if height>h+3:warnings.append({'slide':i,'text':e['text'],'height':height,'box':h})
   c.setFillColor(HexColor(e['color']));c.setFont(font,size)
   base=540-y-pdfmetrics.getAscent(font)*size/1000
   for line in lines:c.drawString(x,base,line);base-=lead
 if i==8:
  c.linkURL('https://www.keejob.com/recruiter/',(48,19,236,39),relative=0,thickness=0)
  c.linkURL('https://www.tanitjobs.com/',(237,19,343,39),relative=0,thickness=0)
  c.linkURL('https://business.linkedin.com/content/dam/me/business/en-us/talent-solutions-lodestone/body/pdf/RecruiterDataSheet-LI.pdf',(344,19,540,39),relative=0,thickness=0)
 c.showPage()
c.save()
(B/'pdf-fit.json').write_text(json.dumps(warnings,indent=2,ensure_ascii=False),encoding='utf8')
print('PDF:',OUT,'Pages:',len(slides),'Fit warnings:',json.dumps(warnings,ensure_ascii=False))
