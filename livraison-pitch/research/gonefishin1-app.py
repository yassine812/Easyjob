import os
import re
import shutil
import sys
import gradio as gr
from src.gradio_demo import SadTalker

try:
    import webui
    in_webui = True
except Exception:
    in_webui = False


def _sanitize_video_path(video_path):
    """Copy the video to a sanitized path if the filename contains characters
    that break Gradio's FFmpeg postprocessing (e.g. ``#``).

    Gradio's ``_format_video`` runs ``ffmpeg -y -i <in> <out>`` where ``<out>``
    is derived from the original path. When the filename contains ``#``, the
    derived output collapses to the same path as the input, and FFmpeg exits
    with "Output same as Input — exiting".
    """
    if not video_path or not os.path.isfile(video_path):
        return video_path

    dirname = os.path.dirname(video_path)
    basename = os.path.basename(video_path)

    sanitized = re.sub(r"[^a-zA-Z0-9._-]", "_", basename)

    if sanitized == basename:
        return video_path

    sanitized_path = os.path.join(dirname, sanitized)
    shutil.copy2(video_path, sanitized_path)

    return sanitized_path


def toggle_audio_file(choice):
    if not choice:
        return gr.update(visible=True), gr.update(visible=False)
    return gr.update(visible=False), gr.update(visible=True)


def ref_video_fn(path_of_ref_video):
    if path_of_ref_video is not None:
        return gr.update(value=True)
    return gr.update(value=False)


sad_talker = SadTalker("checkpoints", "src/config", lazy_load=True)


with gr.Blocks(analytics_enabled=False) as demo:
    gr.Markdown(
        "<b>😭 SadTalker: Learning Realistic 3D Motion Coefficients "
        "for Stylized Audio-Driven Single Image Talking Face Animation (CVPR 2023)</b>"
    )

    with gr.Row():
        with gr.Column(variant="panel"):
            with gr.Tabs(elem_id="sadtalker_source_image"):
                with gr.TabItem("Upload image"):
                    with gr.Row():
                        source_image = gr.Image(
                            label="Source image",
                            type="filepath",
                            elem_id="img2img_image",
                        )

            with gr.Tabs(elem_id="sadtalker_driven_audio"):
                with gr.TabItem("Upload OR TTS"):
                    with gr.Column(variant="panel"):
                        driven_audio = gr.Audio(
                            label="Input audio",
                            type="filepath",
                        )

        with gr.Column(variant="panel"):
            with gr.Tabs(elem_id="sadtalker_checkbox"):
                with gr.TabItem("Settings"):
                    gr.Markdown(
                        "Need help? Visit our "
                        "[best practice page](https://github.com/OpenTalker/SadTalker/blob/main/docs/best_practice.md)"
                    )
                    with gr.Column(variant="panel"):
                        pose_style = gr.Slider(
                            minimum=0, maximum=46, step=1,
                            label="Pose style", value=0,
                        )
                        size_of_image = gr.Radio(
                            [256, 512], value=256,
                            label="Face model resolution",
                            info="use 256/512 model?",
                        )
                        preprocess_type = gr.Radio(
                            ["crop", "resize", "full", "extcrop", "extfull"],
                            value="crop",
                            label="Preprocess",
                            info="How to handle input image?",
                        )
                        is_still_mode = gr.Checkbox(
                            label="Still Mode (fewer head motion, works with preprocess `full`)",
                        )
                        batch_size = gr.Slider(
                            label="Batch size in generation",
                            step=1, maximum=10, value=2,
                        )
                        enhancer = gr.Checkbox(label="GFPGAN as Face enhancer")
                        submit = gr.Button(
                            "Generate",
                            elem_id="sadtalker_generate",
                            variant="primary",
                        )

            with gr.Tabs(elem_id="sadtalker_generated"):
                gen_video = gr.Video(label="Generated video", format="mp4")

    def _generate(source, audio, preprocess, still, enhance, batch, size, pose):
        result = sad_talker.test(source, audio, preprocess, still, enhance, batch, size, pose)

        return _sanitize_video_path(result)

    submit.click(
        fn=_generate,
        inputs=[
            source_image,
            driven_audio,
            preprocess_type,
            is_still_mode,
            enhancer,
            batch_size,
            size_of_image,
            pose_style,
        ],
        outputs=[gen_video],
    )


demo.queue().launch()
