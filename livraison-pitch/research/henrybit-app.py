import gc
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import gradio as gr
import librosa
import numpy as np
import spaces
import torch
from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "SadTalker"
CHECKPOINT_DIR = ROOT / "checkpoints"
RESULT_DIR = ROOT / "results"
SADTALKER_REPO = "https://github.com/OpenTalker/SadTalker.git"
MODEL_REPO = "vinthony/SadTalker-V002rc"


def prepare_runtime() -> None:
    """Fetch the upstream application and the 256px checkpoints on CPU."""
    if not (SOURCE_DIR / "src" / "gradio_demo.py").exists():
        print("Cloning the official SadTalker source...")
        subprocess.run(
            ["git", "clone", "--depth", "1", SADTALKER_REPO, str(SOURCE_DIR)],
            check=True,
        )

    # NumPy 1.24+ no longer silently converts one-element arrays while
    # constructing another array. SadTalker's POS() returns s and t entries as
    # one-element arrays, so normalize them explicitly before packaging the
    # alignment parameters.
    preprocess_file = SOURCE_DIR / "src" / "face3d" / "util" / "preprocess.py"
    preprocess_source = preprocess_file.read_text()
    legacy_line = "trans_params = np.array([w0, h0, s, t[0], t[1]])"
    fixed_line = (
        "trans_params = np.array([w0, h0, "
        "float(np.asarray(s).reshape(-1)[0]), "
        "float(np.asarray(t[0]).reshape(-1)[0]), "
        "float(np.asarray(t[1]).reshape(-1)[0])])"
    )
    if legacy_line in preprocess_source:
        preprocess_file.write_text(preprocess_source.replace(legacy_line, fixed_line))

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    required = (
        "SadTalker_V0.0.2_256.safetensors",
        "mapping_00109-model.pth.tar",
        "mapping_00229-model.pth.tar",
    )
    if not all((CHECKPOINT_DIR / name).exists() for name in required):
        print("Downloading SadTalker 0.0.2 256px checkpoints...")
        snapshot_download(
            repo_id=MODEL_REPO,
            local_dir=CHECKPOINT_DIR,
            allow_patterns=list(required),
        )

    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    if str(SOURCE_DIR) not in sys.path:
        sys.path.insert(0, str(SOURCE_DIR))


prepare_runtime()


# SadTalker and some of its legacy dependencies still reference NumPy aliases
# removed in NumPy 1.24. Keep the compatibility local to this application.
_NUMPY_LEGACY_ALIASES = {
    "bool": np.bool_,
    "complex": np.complex128,
    "float": float,
    "int": int,
    "object": np.object_,
}
for _name, _value in _NUMPY_LEGACY_ALIASES.items():
    if _name not in np.__dict__:
        setattr(np, _name, _value)


# SadTalker's trusted legacy checkpoints predate torch.load(weights_only=True),
# which became PyTorch's default in 2.6.
_torch_load = torch.load


def _legacy_torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _torch_load(*args, **kwargs)


torch.load = _legacy_torch_load


# basicsr still imports this torchvision module, removed in newer torchvision.
try:
    import torchvision.transforms.functional as _tv_functional

    sys.modules.setdefault(
        "torchvision.transforms.functional_tensor", _tv_functional
    )
except Exception as exc:
    print(f"torchvision compatibility alias was not installed: {exc}")


def estimate_gpu_duration(_image, audio, *_args):
    """Reserve enough ZeroGPU time for short clips, capped at 10 minutes."""
    try:
        duration = float(librosa.get_duration(path=audio))
    except Exception:
        duration = 10.0
    return max(90, min(600, int(75 + duration * 20)))


def _copy_input(path: str, destination: Path) -> str:
    source = Path(path)
    suffix = source.suffix.lower()
    target = destination / f"{uuid.uuid4().hex}{suffix}"
    shutil.copy2(source, target)
    return str(target)


@spaces.GPU(duration=estimate_gpu_duration)
@torch.inference_mode()
def generate(
    source_image,
    driven_audio,
    preprocess,
    still_mode,
    pose_style,
    expression_scale,
    progress=gr.Progress(track_tqdm=True),
):
    if not source_image:
        raise gr.Error("请上传一张包含清晰人脸的图片。")
    if not driven_audio:
        raise gr.Error("请上传驱动音频。")

    request_dir = RESULT_DIR / f"input-{uuid.uuid4().hex}"
    request_dir.mkdir(parents=True, exist_ok=True)
    image_path = _copy_input(source_image, request_dir)
    audio_path = _copy_input(driven_audio, request_dir)

    gc.collect()
    torch.cuda.empty_cache()

    old_cwd = Path.cwd()
    try:
        os.chdir(SOURCE_DIR)
        from src.gradio_demo import SadTalker

        engine = SadTalker(
            checkpoint_path=str(CHECKPOINT_DIR),
            config_path=str(SOURCE_DIR / "src" / "config"),
            lazy_load=True,
        )
        output = engine.test(
            source_image=image_path,
            driven_audio=audio_path,
            preprocess=preprocess,
            still_mode=bool(still_mode),
            use_enhancer=False,
            batch_size=2,
            size=256,
            pose_style=int(pose_style),
            exp_scale=float(expression_scale),
            result_dir=str(RESULT_DIR),
        )
        if not output or not Path(output).exists():
            raise gr.Error("生成没有产生有效视频，请换用正面、清晰的人像后重试。")

        # Gradio may decide that SadTalker's MP4 needs browser-compatible
        # transcoding. Returning the upstream path lets Gradio accidentally use
        # that same path as both FFmpeg input and output. Always create a
        # separate H.264/AAC presentation file first.
        output_path = Path(output).resolve()
        presentation_dir = RESULT_DIR / "gradio"
        presentation_dir.mkdir(parents=True, exist_ok=True)
        presentation_path = presentation_dir / f"result_{uuid.uuid4().hex}.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(output_path),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "fast",
                "-crf",
                "20",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                str(presentation_path),
            ],
            check=True,
        )
        if not presentation_path.exists() or presentation_path.stat().st_size == 0:
            raise gr.Error("视频已生成，但浏览器兼容格式转换失败。")
        return str(presentation_path)
    except gr.Error:
        raise
    except Exception as exc:
        print("SadTalker generation failed:", repr(exc))
        raise gr.Error(f"生成失败：{exc}") from exc
    finally:
        os.chdir(old_cwd)
        gc.collect()
        torch.cuda.empty_cache()


CSS = """
.main-title { text-align: center; margin-bottom: .2rem; }
.subtitle { text-align: center; color: #6b7280; margin-bottom: 1.25rem; }
.primary-btn { min-height: 48px; }
"""

with gr.Blocks(css=CSS, title="SadTalker") as demo:
    gr.Markdown("# SadTalker", elem_classes=["main-title"])
    gr.Markdown(
        "上传单张人像与驱动音频，生成包含口型、表情和头部动作的说话视频。",
        elem_classes=["subtitle"],
    )

    with gr.Row():
        with gr.Column():
            source_image = gr.Image(
                label="人像图片",
                type="filepath",
                sources=["upload"],
                height=360,
            )
            driven_audio = gr.Audio(
                label="驱动音频",
                type="filepath",
                sources=["upload"],
            )

            with gr.Accordion("生成设置", open=False):
                preprocess = gr.Radio(
                    choices=[
                        ("裁剪人脸（推荐）", "crop"),
                        ("完整图片", "full"),
                        ("扩展裁剪", "extcrop"),
                        ("扩展完整图片", "extfull"),
                        ("缩放图片", "resize"),
                    ],
                    value="crop",
                    label="图片预处理",
                )
                still_mode = gr.Checkbox(
                    value=False,
                    label="静止模式（减少头部运动，适合完整图片）",
                )
                pose_style = gr.Slider(
                    0, 45, value=0, step=1, label="姿态风格"
                )
                expression_scale = gr.Slider(
                    0.5, 2.0, value=1.0, step=0.1, label="表情强度"
                )

            submit = gr.Button(
                "生成视频", variant="primary", elem_classes=["primary-btn"]
            )

        with gr.Column():
            output_video = gr.Video(
                label="生成结果",
                autoplay=False,
                height=520,
            )
            gr.Markdown(
                "首次生成需要加载模型，耗时会更长。建议使用正面、无遮挡、"
                "光线均匀的人像和 30 秒以内的清晰语音。"
            )

    submit.click(
        fn=generate,
        inputs=[
            source_image,
            driven_audio,
            preprocess,
            still_mode,
            pose_style,
            expression_scale,
        ],
        outputs=output_video,
    )

demo.queue(default_concurrency_limit=1, max_size=8)

if __name__ == "__main__":
    demo.launch()
