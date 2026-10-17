from pathlib import Path
import av
B=Path(__file__).resolve().parent/'assets'
B.mkdir(exist_ok=True)
c=av.open(r'C:\Users\Yassine\Downloads\easyjob-tutoriel-dark.mp4')
for name,t in [('cover',269),('candidate',30),('recruiter',151),('matching',208),('interview',234)]:
 c.seek(t*1000000)
 for f in c.decode(video=0):
  if f.time>=t:
   f.to_image().save(B/(name+'.png'));break
print('Five authentic application images extracted')
