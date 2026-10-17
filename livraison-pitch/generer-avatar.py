"""Use the public free SadTalker Space; never buys or retries past quota limits."""
import argparse
import json
from pathlib import Path
import shutil
from gradio_client import Client, handle_file

parser = argparse.ArgumentParser()
parser.add_argument('--audio', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--cpu-space', action='store_true')
parser.add_argument('--legacy-space')
parser.add_argument('--hosted-demo', action='store_true')
args = parser.parse_args()
space = 'Acmason/sadtalker-demo' if args.hosted_demo else (args.legacy_space or ('John6666/SadTalker' if args.cpu_space else 'henrybit/SadTalker-Demo'))
client = Client(space, verbose=False)
print('Submitting portrait and audio to free SadTalker Space.', flush=True)
params = dict(
    source_image=handle_file(r'C:\Users\Yassine\Downloads\profile.jpg'),
    driven_audio=handle_file(str(Path(args.audio).resolve())),
    preprocess='full', still_mode=True, pose_style=0,
)
if args.cpu_space:
    params.update(use_enhancer=False, batch_size=1, size=256, facerender='facevid2vid', exp_scale=1.0, use_ref_video=False, ref_video=None, ref_info='pose', use_idle_mode=False, length_of_audio=5, use_blink=True, api_name='/test')
else:
    params.update(expression_scale=1.0, api_name='/generate')
if args.hosted_demo:
    job = client.submit(image_path=params['source_image'], audio_path=params['driven_audio'], facerender='facevid2vid', expression_scale=1.0, pose_style=0, api_name='/generate_video')
elif args.legacy_space:
    job = client.submit(r'C:\Users\Yassine\Downloads\profile.jpg', str(Path(args.audio).resolve()), 'full', True, False, 1, 256, 0, fn_index=0)
else:
    job = client.submit(**params)
import time
try:
    while not job.done():
        if Path(args.output + '.cancel').exists():
            job.cancel()
            raise SystemExit('Cancelled by local request')
        status = job.status()
        Path(args.output + '.status.txt').write_text(str(status), encoding='utf-8')
        print(str(status), flush=True)
        time.sleep(20)
except BaseException:
    job.cancel()
    raise
result = job.result()
print(json.dumps(result, ensure_ascii=True), flush=True)
if args.hosted_demo:
    result = result[0]
video = result['video'] if isinstance(result, dict) else result
if isinstance(video, (list, tuple)):
    video = video[0]
if isinstance(video, dict):
    video = video['path']
shutil.copy2(video, args.output)
print('Saved:', str(Path(args.output).resolve()), flush=True)
