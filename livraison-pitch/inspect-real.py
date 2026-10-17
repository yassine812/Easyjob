import av,json
from pathlib import Path
from PIL import Image,ImageDraw
B=Path(__file__).resolve().parent
for name in ['easyjob-tutoriel-dark.mp4','easyjob-demo.mp4']:
 p=Path('C:/Users/Yassine/Downloads')/name
 c=av.open(str(p));duration=c.duration/1e6
 print(name,duration,flush=True)
 times=list(range(0,int(duration),15))
 sheet=Image.new('RGB',(960,200*((len(times)+2)//3)))
 d=ImageDraw.Draw(sheet)
 for i,t in enumerate(times):
  c.seek(int(t*1e6));f=next(c.decode(video=0));im=f.to_image();im.thumbnail((320,180));x=i%3*320;y=i//3*200;sheet.paste(im,(x,y));d.text((x+5,y+180),str(t)+'s',fill='white')
 sheet.save(B/(name+'.contact.jpg'))
 c.close()
