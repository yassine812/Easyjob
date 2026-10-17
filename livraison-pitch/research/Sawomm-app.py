"""LongCat Video Avatar 1.5: single-process, native SDPA, ZeroGPU."""
import spaces  # Must precede torch and every CUDA-dependent import.
import gc
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import time
import traceback
import zipfile

ROOT = Path(__file__).resolve().parent
with zipfile.ZipFile(ROOT / 'longcat_source.zip') as archive:
    archive.extractall(ROOT)

import gradio as gr
import numpy as np
from PIL import Image, ImageOps
import soundfile as sf
import torch
from huggingface_hub import snapshot_download
from transformers import AutoTokenizer, UMT5EncoderModel, WhisperModel, AutoFeatureExtractor
from longcat_video.modules.autoencoder_kl_wan import AutoencoderKLWan
from longcat_video.modules.scheduling_flow_match_euler_discrete import FlowMatchEulerDiscreteScheduler
from longcat_video.modules.quantization import load_quantized_dit
from longcat_video.pipeline_longcat_video_avatar import LongCatVideoAvatarPipeline

FPS = 25
MAX_SECONDS = 2.4
BASE_ID = 'meituan-longcat/LongCat-Video'
MODEL_ID = 'meituan-longcat/LongCat-Video-Avatar-1.5'
BASE_REV = '03b55529b1d1d4045f5fbe14d65c8c6e8116b278'
MODEL_REV = '92016c71d5d318d0f5d84e4db30015a571484ab6'
PROMPT = ('A realistic person speaks naturally to the camera, with accurate lip movements, '
          'gentle spontaneous head motion, subtle facial expressions and natural blinking. '
          'Maintain the exact facial identity, hairstyle, clothing and background of the reference. '
          'Steady camera, continuous shot, realistic skin texture, no scene cuts.')
NEGATIVE = 'deformed face, different identity, distorted mouth, blurry, text, subtitles, camera movement'

print('Downloading pinned model weights (CPU startup, no GPU quota).', flush=True)
base = snapshot_download(BASE_ID, revision=BASE_REV,
    allow_patterns=['tokenizer/*', 'text_encoder/*', 'vae/*'], max_workers=4)
model = snapshot_download(MODEL_ID, revision=MODEL_REV,
    allow_patterns=['base_model_int8/*', 'lora/dmd_lora.safetensors', 'scheduler/*',
                    'whisper-large-v3/config.json', 'whisper-large-v3/preprocessor_config.json',
                    'whisper-large-v3/model.safetensors'], max_workers=4)
print('Loading INT8 DiT with meta initialization.', flush=True)
dit = load_quantized_dit(model, cp_split_hw=[1, 1], enable_flashattn2=False,
                         enable_flashattn3=False, enable_xformers=False, enable_bsa=False)
dit.load_lora(str(Path(model)/'lora/dmd_lora.safetensors'), 'dmd',
              multiplier=1.0, lora_network_dim=128, lora_network_alpha=64)
dit.enable_loras(['dmd'])
for network in dit.lora_dict.values():
    for layer in network.loras:
        layer.to(dtype=torch.bfloat16)
dit = dit.eval().to('cuda')
gc.collect()
print('Loading text encoder, VAE and Whisper.', flush=True)
tokenizer = AutoTokenizer.from_pretrained(base, subfolder='tokenizer')
text_encoder = UMT5EncoderModel.from_pretrained(base, subfolder='text_encoder',
    torch_dtype=torch.bfloat16, low_cpu_mem_usage=True).eval().to('cuda')
vae = AutoencoderKLWan.from_pretrained(base, subfolder='vae',
    torch_dtype=torch.bfloat16, low_cpu_mem_usage=True).eval().to('cuda')
vae.enable_tiling()
audio_encoder = WhisperModel.from_pretrained(str(Path(model)/'whisper-large-v3'),
    torch_dtype=torch.bfloat16, low_cpu_mem_usage=True).eval().to('cuda')
audio_extractor = AutoFeatureExtractor.from_pretrained(str(Path(model)/'whisper-large-v3'))
scheduler = FlowMatchEulerDiscreteScheduler.from_pretrained(model, subfolder='scheduler')
pipe = LongCatVideoAvatarPipeline(tokenizer, text_encoder, vae, scheduler, dit,
    audio_encoder=audio_encoder, audio_feature_extractor=audio_extractor, model_type='avatar-v1.5')
pipe.to('cuda')  # Startup CUDA emulation; real GPU is allocated only by @spaces.GPU.
print('Models loaded; ready for inference.', flush=True)


def run_ffmpeg(args):
    result = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *args],
                            capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise RuntimeError('Media conversion failed: ' + result.stderr[-1500:])


def prepare(image, audio, work):
    if not image or not audio:
        raise gr.Error('ارفع الصورة وملف الصوت أولًا / Upload image and audio first.')
    if Path(image).suffix.lower() not in {'.jpg', '.jpeg', '.png'}:
        raise gr.Error('Supported images: JPG, JPEG, PNG.')
    if Path(audio).suffix.lower() not in {'.wav', '.mp3', '.m4a'}:
        raise gr.Error('Supported audio: WAV, MP3, M4A.')
    if Path(image).stat().st_size > 25*1024**2 or Path(audio).stat().st_size > 50*1024**2:
        raise gr.Error('Image limit: 25 MB. Audio limit: 50 MB.')
    with Image.open(image) as original:
        if original.width * original.height > 40_000_000:
            raise gr.Error('Image is too large; maximum 40 megapixels.')
        picture = ImageOps.exif_transpose(original).convert('RGB')
    if min(picture.size) < 128:
        raise gr.Error('Use an image of at least 128 pixels on each side.')
    height, width = pipe.get_condition_shape(picture, '480p', scale_factor_spatial=16)
    # Letterbox to the model bucket: no stretching or face crop.
    picture = ImageOps.pad(picture, (width, height), method=Image.Resampling.LANCZOS, color=(24,24,24))
    wav = work/'audio.wav'
    # Read only enough to reject overlong input, without silently truncating it.
    run_ffmpeg(['-i', str(audio), '-t', str(MAX_SECONDS+1), '-vn', '-ac', '1', '-ar', '16000', str(wav)])
    samples, sr = sf.read(wav, dtype='float32')
    duration = len(samples)/sr
    if not 0.5 <= duration <= MAX_SECONDS+0.001:
        raise gr.Error(f'Use speech between 0.5 and {MAX_SECONDS} seconds for this version.')
    if not np.isfinite(samples).all() or np.max(np.abs(samples)) < 1e-5:
        raise gr.Error('Audio is silent or invalid.')
    frame_count = min(61, max(17, 4*math.ceil((duration*FPS-1)/4)+1))
    samples = np.pad(samples, (0, max(0, math.ceil(frame_count/FPS*sr)-len(samples))))
    return picture, samples, wav, duration, frame_count


def gpu_duration(picture, samples, frame_count, seed):
    # ZeroGPU's 48 GB slice bills duration at 1.5x. A free account accepts
    # at most 180 billed seconds, therefore this lease must not exceed 120 s.
    return min(120, max(90, math.ceil(30 + 1.35*frame_count + 0.004*frame_count**2)))


@spaces.GPU(duration=gpu_duration)
def infer(picture, samples, frame_count, seed):
    started = time.perf_counter()
    torch.cuda.reset_peak_memory_stats()
    with torch.inference_mode():
        features = pipe.get_audio_embedding(samples, fps=FPS, device='cuda',
                                            sample_rate=16000, model_type='avatar-v1.5')
        if not torch.isfinite(features).all():
            raise RuntimeError('Non-finite audio embeddings.')
        centers = torch.arange(frame_count).unsqueeze(1) + torch.arange(-2,3).unsqueeze(0)
        centers = centers.clamp(0, features.shape[0]-1)
        audio_emb = features[centers][None].to('cuda')
        frames = pipe.generate_ai2v(image=picture, prompt=PROMPT, negative_prompt=NEGATIVE,
            resolution='480p', num_frames=frame_count, num_inference_steps=8,
            text_guidance_scale=1.0, audio_guidance_scale=1.0, use_distill=True,
            generator=torch.Generator(device='cuda').manual_seed(int(seed)),
            audio_emb=audio_emb, output_type='np', resize_mode='default')[0]
        frames = np.clip(frames*255,0,255).astype(np.uint8)
    torch.cuda.synchronize()
    metrics = {'model': MODEL_ID, 'revision': MODEL_REV, 'quantization':'INT8 weight-only',
               'gpu':torch.cuda.get_device_name(0), 'torch':torch.__version__, 'cuda':torch.version.cuda,
               'peak_vram_gib':round(torch.cuda.max_memory_allocated()/1024**3,2),
               'inference_seconds':round(time.perf_counter()-started,2), 'fps':FPS,
               'frames':len(frames), 'width':frames.shape[2], 'height':frames.shape[1]}
    print(json.dumps(metrics), flush=True)
    return frames, metrics


def generate(image, audio, seed=42, progress=gr.Progress()):
    work = Path(tempfile.mkdtemp(prefix='talking-portrait-'))
    try:
        progress(0.02, desc='Preparing image and audio')
        picture, samples, wav, duration, count = prepare(image, audio, work)
        progress(0.08, desc='Waiting for GPU / Generating video')
        frames, metrics = infer(picture, samples, count, seed)
        progress(0.9, desc='Encoding downloadable video')
        import imageio.v2 as imageio
        silent = work/'silent.mp4'
        with imageio.get_writer(silent, fps=FPS, codec='libx264', quality=8,
                                macro_block_size=1, ffmpeg_log_level='error') as writer:
            for frame in frames[:math.ceil(duration*FPS)]:
                writer.append_data(frame)
        result = work/'result.mp4'
        run_ffmpeg(['-i', str(silent), '-i', str(wav), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(duration),
                    '-movflags', '+faststart', str(result)])
        metrics['audio_seconds'] = duration
        (work/'metrics.json').write_text(json.dumps(metrics, indent=2))
        for temporary in (silent, wav):
            temporary.unlink(missing_ok=True)
        progress(1, desc='Ready')
        return str(result), str(result), metrics
    except gr.Error:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise gr.Error(f'Generation failed: {type(exc).__name__}: {exc}') from exc


with gr.Blocks(title='Talking Portrait', delete_cache=(3600,3600)) as demo:
    gr.Markdown('# الصورة الناطقة · Talking Portrait\nارفع صورة وصوتًا ثم اضغط إنشاء الفيديو.\n'
                f'LongCat Video Avatar 1.5 · Audio: 0.5–{MAX_SECONDS} seconds · 480p · 25 fps')
    with gr.Row():
        image = gr.File(label='Upload Image · الصورة', file_types=['.jpg','.jpeg','.png'], type='filepath')
        audio = gr.File(label='Upload Audio · الصوت', file_types=['.wav','.mp3','.m4a'], type='filepath')
    with gr.Accordion('Advanced', open=False):
        seed = gr.Number(label='Seed', value=42, precision=0, minimum=0, maximum=2147483647)
    button = gr.Button('Generate Video · إنشاء الفيديو', variant='primary')
    preview = gr.Video(label='Preview · معاينة', format='mp4')
    download = gr.File(label='Download Result · تنزيل الفيديو')
    with gr.Accordion('Run details', open=False):
        details = gr.JSON(label='Measured runtime and VRAM')
    button.click(generate, [image,audio,seed], [preview,download,details],
                 api_name='generate', concurrency_limit=1)

demo.queue(max_size=8).launch(ssr_mode=False, show_error=True)
