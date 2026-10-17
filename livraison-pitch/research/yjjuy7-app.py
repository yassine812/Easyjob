import sys, os, tempfile, subprocess, urllib.request

os.environ["CUDA_VISIBLE_DEVICES"] = ""

def download_checkpoints():
    ckpt_dir = "/app/SadTalker/checkpoints"
    mapping_dir = "/app/SadTalker/gfpgan/weights"

    if os.path.exists(os.path.join(ckpt_dir, "auido2exp_00300-model.pth")):
        print("Checkpoints already present ✓")
        return

    print("Downloading SadTalker checkpoints...")
    os.makedirs(ckpt_dir, exist_ok=True)
    os.makedirs(mapping_dir, exist_ok=True)

    from huggingface_hub import snapshot_download
    snapshot_download(
        repo_id="vinthony/SadTalker",
        local_dir=ckpt_dir,
        ignore_patterns=["*.gitattributes", "README.md"],
    )
    print("  ✓ SadTalker weights")

    # GFPGAN from GitHub release
    gfpgan_dst = os.path.join(mapping_dir, "GFPGANv1.4.pth")
    if not os.path.exists(gfpgan_dst):
        print("Downloading GFPGANv1.4...")
        urllib.request.urlretrieve(
            "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth",
            gfpgan_dst
        )
        print("  ✓ GFPGANv1.4.pth")

    print("All checkpoints ready ✓")

download_checkpoints()

sys.path.insert(0, "/app/SadTalker")
os.chdir("/app/SadTalker")

import gradio as gr

# Patch get_api_info to avoid schema crash
import gradio.blocks as _gb
_orig = _gb.Blocks.get_api_info
def _safe(self):
    try:
        return _orig(self)
    except Exception:
        return {}
_gb.Blocks.get_api_info = _safe

def talk(source_image, driven_audio, preprocess="crop", still_mode=True, use_enhancer=False, size=256):
    if source_image is None or driven_audio is None:
        return None

    out_dir = tempfile.mkdtemp()
    cmd = [
        "python", "inference.py",
        "--driven_audio", driven_audio,
        "--source_image", source_image,
        "--result_dir", out_dir,
        "--preprocess", preprocess,
        "--size", str(size),
        "--cpu",
        "--checkpoint_dir", "/app/SadTalker/checkpoints",
        "--config_dir", "/app/SadTalker/src/config",
    ]
    if still_mode:
        cmd.append("--still")
    if use_enhancer:
        cmd += ["--enhancer", "gfpgan"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            print("STDERR:", result.stderr[-1000:])
            return None
        for f in os.listdir(out_dir):
            if f.endswith(".mp4"):
                return os.path.join(out_dir, f)
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

with gr.Blocks(title="SadTalker 🗣️") as demo:
    gr.Markdown("# 🗣️ SadTalker\nGenerate a talking head video from a photo + audio.\n> ⚠️ CPU mode — takes ~5-10 min per video.")
    with gr.Row():
        with gr.Column():
            img = gr.Image(label="Source Portrait", type="filepath")
            audio = gr.Audio(label="Driving Audio", type="filepath")
            with gr.Row():
                preprocess = gr.Dropdown(["crop", "resize", "full"], value="crop", label="Preprocess")
                size = gr.Dropdown([256, 512], value=256, label="Size")
            still = gr.Checkbox(label="Still Mode", value=True)
            enhance = gr.Checkbox(label="GFPGAN Enhancer", value=False)
            btn = gr.Button("🎬 Generate!", variant="primary")
        with gr.Column():
            out = gr.Video(label="Result")

    btn.click(fn=talk, inputs=[img, audio, preprocess, still, enhance, size], outputs=[out])

demo.launch(server_name="0.0.0.0", server_port=7860)
