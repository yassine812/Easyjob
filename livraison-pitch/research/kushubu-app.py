import os, sys
import tempfile

# --- torch 2.x compatibility shims for this repo's old (torch 1.13-era) code ---
# basicsr (pulled in by gfpgan/facexlib) imports a module torchvision removed in 0.17+.
import sys as _sys, types as _types
try:
    import torchvision.transforms.functional_tensor  # noqa
except ImportError:
    import torchvision.transforms.functional as _tvf
    _shim = _types.ModuleType("torchvision.transforms.functional_tensor")
    _shim.rgb_to_grayscale = _tvf.rgb_to_grayscale
    _sys.modules["torchvision.transforms.functional_tensor"] = _shim

# torch>=2.6 defaults torch.load(weights_only=True), which breaks loading these
# older SadTalker checkpoint files (plain state_dicts saved pre-2.6). We trust these
# checkpoints (official SadTalker weights downloaded by this app itself).
import torch as _torch
_orig_torch_load = _torch.load
def _compat_torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _orig_torch_load(*args, **kwargs)
_torch.load = _compat_torch_load

# numpy>=1.24 removed the deprecated np.float/np.int/np.bool aliases that
# facexlib (face landmark detection) still uses.
import numpy as _np
if not hasattr(_np, "float"):
    _np.float = float
if not hasattr(_np, "int"):
    _np.int = int
if not hasattr(_np, "bool"):
    _np.bool = bool
# --- end compatibility shims ---

import spaces
import gradio as gr
from src.gradio_demo import SadTalker
# from src.utils.text2speech import TTSTalker
from huggingface_hub import snapshot_download

def get_source_image(image):
        return image

try:
    import webui  # in webui
    in_webui = True
except:
    in_webui = False


def toggle_audio_file(choice):
    if choice == False:
        return gr.update(visible=True), gr.update(visible=False)
    else:
        return gr.update(visible=False), gr.update(visible=True)

def ref_video_fn(path_of_ref_video):
    if path_of_ref_video is not None:
        return gr.update(value=True)
    else:
        return gr.update(value=False)

def download_model():
    REPO_ID = 'vinthony/SadTalker-V002rc'
    snapshot_download(repo_id=REPO_ID, local_dir='./checkpoints', local_dir_use_symlinks=True)

def sadtalker_demo():

    download_model()

    sad_talker = SadTalker(lazy_load=True)
    # tts_talker = TTSTalker()

    @spaces.GPU(duration=120)
    def run_sadtalker(source_image, driven_audio, preprocess_type, is_still_mode, enhancer,
                       batch_size, size_of_image, pose_style, facerender, exp_weight,
                       use_ref_video, ref_video, ref_info, use_idle_mode, length_of_audio, blink_every):
        return sad_talker.test(source_image, driven_audio, preprocess_type, is_still_mode, enhancer,
                                batch_size, size_of_image, pose_style, facerender, exp_weight,
                                use_ref_video, ref_video, ref_info, use_idle_mode, length_of_audio, blink_every)

    with gr.Blocks(analytics_enabled=False) as sadtalker_interface:
        gr.Markdown("<div align='center'> <h2> 😭 SadTalker: Learning Realistic 3D Motion Coefficients for Stylized Audio-Driven Single Image Talking Face Animation (CVPR 2023) </span> </h2> \
                    <a style='font-size:18px;color: #efefef' href='https://arxiv.org/abs/2211.12194'>Arxiv</a> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; \
                    <a style='font-size:18px;color: #efefef' href='https://sadtalker.github.io'>Homepage</a>  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; \
                     <a style='font-size:18px;color: #efefef' href='https://github.com/Winfredy/SadTalker'> Github </div>")


        gr.Markdown("""
        <b>You may duplicate the space and upgrade to GPU in settings for better performance and faster inference without waiting in the queue. <a style='display:inline-block' href="https://huggingface.co/spaces/vinthony/SadTalker?duplicate=true"><img src="https://bit.ly/3gLdBN6" alt="Duplicate Space"></a></b> \
        <br/><b>Alternatively, try our GitHub <a href=https://github.com/Winfredy/SadTalker> code </a> on your own GPU. </b> <a style='display:inline-block' href="https://github.com/Winfredy/SadTalker"><img src="https://img.shields.io/github/stars/Winfredy/SadTalker?style=social"/></a> \
        """)

        with gr.Row(): #.style(equal_height=False):
            with gr.Column(variant='panel'):
                with gr.Tabs(elem_id="sadtalker_source_image"):
                    with gr.TabItem('Source image'):
                        with gr.Row():
                            source_image = gr.Image(label="Source image", type="filepath", elem_id="img2img_image") # .style(width=512)


                with gr.Tabs(elem_id="sadtalker_driven_audio"):
                    with gr.TabItem('Driving Methods'):
                        gr.Markdown("Possible driving combinations: <br> 1. Audio only 2. Audio/IDLE Mode + Ref Video(pose, blink, pose+blink) 3. IDLE Mode only 4. Ref Video only (all) ")

                        with gr.Row():
                            driven_audio = gr.Audio(label="Input audio", type="filepath", max_length=180) # 180s
                            driven_audio_no = gr.Audio(label="Use IDLE mode, no audio is required", type="filepath", visible=False)

                            with gr.Column():
                                use_idle_mode = gr.Checkbox(label="Use Idle Animation")
                                length_of_audio = gr.Number(value=5, label="The length(seconds) of the generated video.")
                                use_idle_mode.change(toggle_audio_file, inputs=use_idle_mode, outputs=[driven_audio, driven_audio_no]) # todo

                        with gr.Row():
                            ref_video = gr.Video(label="Reference Video", sources=["upload"], elem_id="vidref") # .style(width=512)

                            with gr.Column():
                                use_ref_video = gr.Checkbox(label="Use Reference Video")
                                ref_info = gr.Radio(['pose', 'blink','pose+blink', 'all'], value='pose', label='Reference Video',info="How to borrow from reference Video?((fully transfer, aka, video driving mode))")

                            ref_video.change(ref_video_fn, inputs=ref_video, outputs=[use_ref_video]) # todo


            with gr.Column(variant='panel'):
                with gr.Tabs(elem_id="sadtalker_checkbox"):
                    with gr.TabItem('Settings'):
                        gr.Markdown("need help? please visit our [[best practice page](https://github.com/OpenTalker/SadTalker/blob/main/docs/best_practice.md)] for more detials")
                        with gr.Column(variant='panel'):
                            # width = gr.Slider(minimum=64, elem_id="img2img_width", maximum=2048, step=8, label="Manually Crop Width", value=512) # img2img_width
                            # height = gr.Slider(minimum=64, elem_id="img2img_height", maximum=2048, step=8, label="Manually Crop Height", value=512) # img2img_width
                            with gr.Row():
                                pose_style = gr.Slider(minimum=0, maximum=45, step=1, label="Pose style", value=0) #
                                exp_weight = gr.Slider(minimum=0, maximum=3, step=0.1, label="expression scale", value=1) #
                                blink_every = gr.Checkbox(label="use eye blink", value=True)

                            with gr.Row():
                                size_of_image = gr.Radio([256, 512], value=256, label='face model resolution', info="use 256/512 model?") #
                                preprocess_type = gr.Radio(['crop', 'resize','full', 'extcrop', 'extfull'], value='crop', label='preprocess', info="How to handle input image?")

                            with gr.Row():
                                is_still_mode = gr.Checkbox(label="Still Mode (fewer head motion, works with preprocess `full`)")
                                facerender = gr.Radio(['facevid2vid','pirender'], value='facevid2vid', label='facerender', info="which face render?")

                            with gr.Row():
                                batch_size = gr.Slider(label="batch size in generation", step=1, maximum=10, value=1)
                                enhancer = gr.Checkbox(label="GFPGAN as Face enhancer")

                            submit = gr.Button('Generate', elem_id="sadtalker_generate", variant='primary')

                with gr.Tabs(elem_id="sadtalker_genearted"):
                        gen_video = gr.Video(label="Generated video", scale=1) # .style(width=256)



        submit.click(
                fn=run_sadtalker,
                inputs=[source_image,
                        driven_audio,
                        preprocess_type,
                        is_still_mode,
                        enhancer,
                        batch_size,
                        size_of_image,
                        pose_style,
                        facerender,
                        exp_weight,
                        use_ref_video,
                        ref_video,
                        ref_info,
                        use_idle_mode,
                        length_of_audio,
                        blink_every
                        ],
                outputs=[gen_video],
                )

    return sadtalker_interface


if __name__ == "__main__":

    demo = sadtalker_demo()
    demo.queue(max_size=10, api_open=True)
    demo.launch(debug=True)
