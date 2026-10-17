import gradio as gr
import subprocess
import os
import requests
from datetime import datetime

# 🔽 Dosya yoksa Hugging Face'ten indir
def download_if_missing(url, local_path):
    if not os.path.exists(local_path):
        print(f"⬇️ İndiriliyor: {url}")
        r = requests.get(url)
        r.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(r.content)
    else:
        print(f"✅ Zaten var: {local_path}")

# 📦 Tüm model dosyalarını indir
def fetch_all_checkpoints():
    os.makedirs("checkpoints", exist_ok=True)
    base_url = "https://huggingface.co/akin23/SadTalker-Checkpoints/resolve/main"

    files = [
        "facevid2vid_00189-model_aa",
        "facevid2vid_00189-model_bb",
        "facevid2vid_00189-model_cc",
        "facevid2vid_00189-model_dd",
        "facevid2vid_00189-model_ee",
        "epoch_20.pth",
        "mapping_00109-model.pth.tar",
        "mapping_00229-model.pth.tar",
        "auido2exp_00300-model.pth",
        "auido2pose_00140-model.pth",
        "shape_predictor_68_face_landmarks.dat"
    ]

    for filename in files:
        url = f"{base_url}/{filename}"
        local_path = f"checkpoints/{filename}"
        download_if_missing(url, local_path)

# 🔧 facevid2vid parçalarını birleştir
def merge_model_parts():
    parts = [
        "checkpoints/facevid2vid_00189-model_aa",
        "checkpoints/facevid2vid_00189-model_bb",
        "checkpoints/facevid2vid_00189-model_cc",
        "checkpoints/facevid2vid_00189-model_dd",
        "checkpoints/facevid2vid_00189-model_ee"
    ]
    output_file = "checkpoints/facevid2vid_00189-model.pth.tar"

    if not os.path.exists(output_file):
        with open(output_file, "wb") as out:
            for part in parts:
                with open(part, "rb") as p:
                    out.write(p.read())
        print("✅ Model parçaları birleştirildi.")
    else:
        print("🟡 Birleştirilmiş dosya zaten var.")

# 🧩 Dosyaları indir ve birleştir
fetch_all_checkpoints()
merge_model_parts()

# 🔁 Ana video üretim fonksiyonu
def generate_video(source_image, driven_audio):
    output_dir = "results"
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_path = f"{output_dir}/video_{timestamp}.mp4"

    cmd = f"python inference.py --driven_audio {driven_audio} --source_image {source_image} --result_dir {output_dir} --enhancer gfpgan --pose_style 45 --still --preprocess full"
    subprocess.run(cmd, shell=True)

    return result_path

# 🎛️ Gradio arayüzü
demo = gr.Interface(
    fn=generate_video,
    inputs=[
        gr.Image(type="filepath", label="Source Image"),
        gr.Audio(type="filepath", label="Driven Audio")
    ],
    outputs=gr.Video(label="Generated Video")
)

# 🚀 Başlat
demo.launch()
