import gradio as gr
import replicate
import os
import base64
import urllib.request
import tempfile

REPLICATE_API_TOKEN = os.environ.get('REPLICATE_API_TOKEN')

def run_sadtalker(img_b64, audio_b64, facerender, expression_scale, pose_style):
    output = replicate.run(
        'lucataco/sadtalker:85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b',
        input={
            'source_image':    img_b64,
            'driven_audio':    audio_b64,
            'preprocess':      'full',
            'still':           False,
            'use_enhancer':    True,
            'expression_scale': expression_scale,
            'pose_style':      pose_style,
            'size':            512,
            'facerender':      facerender,
        }
    )
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    urllib.request.urlretrieve(str(output), tmp.name)
    return tmp.name

def generate_video(image_path, audio_path, facerender, expression_scale, pose_style):
    if image_path is None or audio_path is None:
        return None, '❌ 請先上傳圖片和音檔'
    try:
        with open(image_path, 'rb') as f:
            img_b64 = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()
        with open(audio_path, 'rb') as f:
            audio_b64 = 'data:audio/wav;base64,' + base64.b64encode(f.read()).decode()
        result = run_sadtalker(img_b64, audio_b64, facerender, expression_scale, pose_style)
        return result, f'✅ 生成成功！設定：{facerender} / 表情強度 {expression_scale} / 頭部風格 {pose_style}'
    except Exception as e:
        return None, f'❌ 發生錯誤：{str(e)}'


with gr.Blocks(title='AI 說話人像生成器', theme=gr.themes.Soft()) as demo:

    gr.Markdown('# 🎬 AI 說話人像 Demo')
    gr.Markdown('調整下方參數，找出最自然的效果')
    gr.Markdown('---')

    with gr.Row():
        with gr.Column():
            image_input = gr.Image(type='filepath', label='📷 人臉圖片（JPG / PNG）')
            audio_input = gr.Audio(type='filepath', label='🎙️ 音訊檔案（WAV 最佳）')

            gr.Markdown('### ⚙️ 參數調整')
            facerender = gr.Radio(
                choices=['facevid2vid', 'pirender'],
                value='facevid2vid',
                label='渲染引擎（pirender 有時更流暢，試試看）'
            )
            expression_scale = gr.Slider(
                minimum=0.5, maximum=2.0, step=0.1, value=1.2,
                label='表情強度（建議 1.0–1.5，太高會變形）'
            )
            pose_style = gr.Slider(
                minimum=0, maximum=45, step=1, value=0,
                label='頭部姿態風格（0–45，不同數字有不同晃動感）'
            )
            submit_btn = gr.Button('🚀 開始生成', variant='primary', size='lg')

        with gr.Column():
            video_output = gr.Video(label='🎬 生成影片（可直接下載）')
            status_text  = gr.Textbox(label='狀態 / 使用的參數', interactive=False)

    gr.Markdown('> ⏱️ **生成約需 2–3 分鐘**（開了 enhancer），請耐心等候')
    gr.Markdown('> 💡 **建議流程**：先用預設跑一次，再調 pose_style 試 5、10、20 看哪個最自然')

    submit_btn.click(
        fn=generate_video,
        inputs=[image_input, audio_input, facerender, expression_scale, pose_style],
        outputs=[video_output, status_text]
    )

demo.launch()