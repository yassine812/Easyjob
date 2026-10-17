"""Decode the complete delivery and report duration, audio and face motion."""
import argparse
import json
from pathlib import Path
import av
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('video')
a = p.parse_args()
path = Path(a.video)
if not path.is_file() or path.stat().st_size == 0:
    raise SystemExit('Video absente ou vide')
with av.open(str(path)) as c:
    streams = [(s.type, s.codec_context.name) for s in c.streams]
    duration = c.duration / av.time_base if c.duration else None
    count = 0
    previous = None
    changes = []
    for frame in c.decode(video=0):
        if count % 25 == 0:
            arr = frame.to_ndarray(format='gray').astype(float)
            # Presenter area in the 1280x720 composition; excludes cards/captions.
            if frame.width == 1280 and frame.height == 720:
                arr = arr[145:405, 195:480]
            else:
                arr = arr[frame.height//5:frame.height*4//5, frame.width//5:frame.width*4//5]
            if previous is not None:
                changes.append(float(np.abs(arr-previous).mean()))
            previous = arr
        count += 1
with av.open(str(path)) as c:
    audio_samples = sum(f.samples for f in c.decode(audio=0))
report = {'file': str(path.resolve()), 'bytes': path.stat().st_size,
          'duration_seconds': duration, 'streams': streams,
          'decoded_video_frames': count, 'decoded_audio_samples': audio_samples,
          'sampled_face_changes': changes}
path.with_suffix('.verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k != 'sampled_face_changes'}, indent=2))
if duration is None or duration > 180 or count < 2 or audio_samples < 1:
    raise SystemExit('Validation echec')
if not changes or max(changes) < 0.05:
    raise SystemExit('Animation du visage non detectee')
print('Video decodee entierement, audio present, duree sous 3 minutes, variation visuelle presente.')
