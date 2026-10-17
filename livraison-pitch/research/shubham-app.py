# ============================================================
# SadTalker — Hugging Face ZeroGPU
# Complete application
# ============================================================

import os
import sys
import zipfile
import tarfile
import shutil
import types
import re
import warnings
import uuid

# ============================================================
# IMPORTANT ZERO GPU IMPORT ORDER
# ============================================================
# spaces MUST be imported before torch / torchvision / CUDA
# initialization.
# ============================================================

import spaces
import gradio as gr


# ============================================================
# ENVIRONMENT
# ============================================================

os.environ["PYTHONWARNINGS"] = "ignore"


# ============================================================
# PATHS
# ============================================================

BASE_DIR = "/app"

SOURCE_ZIP = os.path.join(
    BASE_DIR,
    "SadTalker_Kaggle.zip"
)

BASICSR_ZIP = os.path.join(
    BASE_DIR,
    "BasicSR_1.4.2.zip"
)

SADTALKER_DIR = os.path.join(
    BASE_DIR,
    "SadTalker"
)

CHECKPOINT_DIR = os.path.join(
    SADTALKER_DIR,
    "checkpoints"
)

MODEL_REPO_ID = "AIwithshubham/sadtalker-models"

TEMP_SADTALKER = os.path.join(
    BASE_DIR,
    "_sadtalker_source"
)

TEMP_BASICSR = os.path.join(
    BASE_DIR,
    "_basicsr_source"
)

USER_INPUT_DIR = os.path.join(
    "/tmp",
    "sadtalker_inputs"
)

os.makedirs(
    USER_INPUT_DIR,
    exist_ok=True
)


# ============================================================
# LOGGING
# ============================================================

def log(message):
    print(
        f"[SadTalker] {message}",
        flush=True
    )


# ============================================================
# NUMPY COMPATIBILITY
# ============================================================

import numpy as np


if not hasattr(
    np,
    "VisibleDeprecationWarning"
):
    np.VisibleDeprecationWarning = DeprecationWarning


if not hasattr(
    np,
    "float"
):
    np.float = float


if not hasattr(
    np,
    "int"
):
    np.int = int


if not hasattr(
    np,
    "bool"
):
    np.bool = bool


if not hasattr(
    np,
    "complex"
):
    np.complex = complex


# ============================================================
# SAFE ZIP EXTRACTION
# ============================================================

def extract_zip_linux(
    zip_path,
    destination
):

    if not os.path.isfile(
        zip_path
    ):
        raise FileNotFoundError(
            f"ZIP not found: {zip_path}"
        )

    os.makedirs(
        destination,
        exist_ok=True
    )

    destination_abs = os.path.abspath(
        destination
    )

    with zipfile.ZipFile(
        zip_path,
        "r"
    ) as archive:

        members = archive.infolist()

        log(
            f"Extracting "
            f"{os.path.basename(zip_path)} "
            f"({len(members)} entries)"
        )

        for member in members:

            # Convert Windows separators
            name = member.filename.replace(
                "\\",
                "/"
            )

            # Remove absolute path
            name = name.lstrip("/")

            destination_path = os.path.normpath(
                os.path.join(
                    destination,
                    name
                )
            )

            # Security check
            if not (
                destination_path == destination_abs
                or destination_path.startswith(
                    destination_abs + os.sep
                )
            ):

                raise RuntimeError(
                    "Unsafe ZIP path: "
                    + member.filename
                )

            # Directory
            if member.is_dir():

                os.makedirs(
                    destination_path,
                    exist_ok=True
                )

                continue

            # File
            parent = os.path.dirname(
                destination_path
            )

            if parent:

                os.makedirs(
                    parent,
                    exist_ok=True
                )

            with archive.open(
                member,
                "r"
            ) as source:

                with open(
                    destination_path,
                    "wb"
                ) as target:

                    shutil.copyfileobj(
                        source,
                        target
                    )

    log(
        "Finished extracting: "
        + os.path.basename(zip_path)
    )


# ============================================================
# SAFE TAR EXTRACTION
# ============================================================

def extract_tar_safe(
    tar_path,
    destination
):

    if not os.path.isfile(
        tar_path
    ):
        raise FileNotFoundError(
            f"TAR not found: {tar_path}"
        )

    os.makedirs(
        destination,
        exist_ok=True
    )

    log(
        "Extracting nested archive: "
        + tar_path
    )

    destination_abs = os.path.abspath(
        destination
    )

    with tarfile.open(
        tar_path,
        "r:*"
    ) as archive:

        for member in archive.getmembers():

            name = member.name.replace(
                "\\",
                "/"
            )

            name = name.lstrip("/")

            target = os.path.abspath(
                os.path.join(
                    destination_abs,
                    name
                )
            )

            # Security check
            if not (
                target == destination_abs
                or target.startswith(
                    destination_abs + os.sep
                )
            ):

                raise RuntimeError(
                    "Unsafe TAR path: "
                    + member.name
                )

            # Directory
            if member.isdir():

                os.makedirs(
                    target,
                    exist_ok=True
                )

                continue

            # Regular file
            if member.isfile():

                parent = os.path.dirname(
                    target
                )

                os.makedirs(
                    parent,
                    exist_ok=True
                )

                source = archive.extractfile(
                    member
                )

                if source is None:
                    continue

                with open(
                    target,
                    "wb"
                ) as output:

                    shutil.copyfileobj(
                        source,
                        output
                    )

                continue

            # Ignore symlinks/hardlinks


# ============================================================
# FIND SADTALKER ROOT
# ============================================================

def locate_sadtalker_root(
    search_root
):

    for root, dirs, files in os.walk(
        search_root
    ):

        if "gradio_demo.py" not in files:
            continue

        candidate = os.path.join(
            root,
            "gradio_demo.py"
        )

        normalized = candidate.replace(
            "\\",
            "/"
        )

        if normalized.endswith(
            "/src/gradio_demo.py"
        ):

            src_dir = os.path.dirname(
                candidate
            )

            return os.path.dirname(
                src_dir
            )

    return None


# ============================================================
# PREPARE SADTALKER SOURCE
# ============================================================

log(
    "Preparing SadTalker source..."
)

GRADIO_DEMO = os.path.join(
    SADTALKER_DIR,
    "src",
    "gradio_demo.py"
)


if not os.path.isfile(
    GRADIO_DEMO
):

    if os.path.exists(
        TEMP_SADTALKER
    ):

        shutil.rmtree(
            TEMP_SADTALKER
        )

    os.makedirs(
        TEMP_SADTALKER,
        exist_ok=True
    )

    if not os.path.isfile(
        SOURCE_ZIP
    ):

        raise RuntimeError(
            "SadTalker source archive not found:\n"
            + SOURCE_ZIP
        )

    extract_zip_linux(
        SOURCE_ZIP,
        TEMP_SADTALKER
    )

    detected_root = locate_sadtalker_root(
        TEMP_SADTALKER
    )

    if detected_root is None:

        log(
            "Could not locate SadTalker root."
        )

        for root, dirs, files in os.walk(
            TEMP_SADTALKER
        ):

            if "gradio_demo.py" in files:

                log(
                    "Candidate: "
                    + os.path.join(
                        root,
                        "gradio_demo.py"
                    )
                )

        raise RuntimeError(
            "Could not find "
            "src/gradio_demo.py "
            "after extraction."
        )

    log(
        "Detected SadTalker root: "
        + detected_root
    )

    if os.path.exists(
        SADTALKER_DIR
    ):

        shutil.rmtree(
            SADTALKER_DIR
        )

    shutil.copytree(
        detected_root,
        SADTALKER_DIR
    )

    log(
        "SadTalker source copied to: "
        + SADTALKER_DIR
    )

else:

    log(
        "SadTalker source already exists."
    )


# ============================================================
# VERIFY SADTALKER SOURCE
# ============================================================

GRADIO_DEMO = os.path.join(
    SADTALKER_DIR,
    "src",
    "gradio_demo.py"
)


if not os.path.isfile(
    GRADIO_DEMO
):

    raise RuntimeError(
        "SadTalker source verification failed:\n"
        + GRADIO_DEMO
    )


log(
    "Verified SadTalker source."
)


# ============================================================
# BASICSR HELPERS
# ============================================================

def locate_basicsr(
    search_root
):

    for root, dirs, files in os.walk(
        search_root
    ):

        if "basicsr" not in dirs:
            continue

        candidate = os.path.join(
            root,
            "basicsr"
        )

        init_file = os.path.join(
            candidate,
            "__init__.py"
        )

        if os.path.isfile(
            init_file
        ):

            return root

    return None


def find_nested_archives(
    search_root
):

    archives = []

    for root, dirs, files in os.walk(
        search_root
    ):

        for filename in files:

            path = os.path.join(
                root,
                filename
            )

            # ZIP
            try:

                if zipfile.is_zipfile(
                    path
                ):

                    archives.append(
                        path
                    )

                    continue

            except Exception:
                pass

            # TAR / TAR.GZ
            try:

                if tarfile.is_tarfile(
                    path
                ):

                    archives.append(
                        path
                    )

            except Exception:
                pass

    return archives


def extract_nested_archives(
    search_root,
    max_rounds=6
):

    processed = set()

    for round_number in range(
        1,
        max_rounds + 1
    ):

        # Look for BasicSR first
        found = locate_basicsr(
            search_root
        )

        if found is not None:

            return found

        archives = find_nested_archives(
            search_root
        )

        new_archives = []

        for archive in archives:

            absolute = os.path.abspath(
                archive
            )

            if absolute not in processed:

                new_archives.append(
                    archive
                )

        if not new_archives:

            break

        log(
            f"Nested archive round "
            f"{round_number}: "
            f"{len(new_archives)} archive(s)"
        )

        for archive in new_archives:

            absolute = os.path.abspath(
                archive
            )

            processed.add(
                absolute
            )

            destination = (
                archive
                + "_extracted"
            )

            # ZIP
            try:

                if zipfile.is_zipfile(
                    archive
                ):

                    extract_zip_linux(
                        archive,
                        destination
                    )

                    continue

            except Exception as e:

                log(
                    "Nested ZIP warning: "
                    + str(e)
                )

            # TAR
            try:

                if tarfile.is_tarfile(
                    archive
                ):

                    extract_tar_safe(
                        archive,
                        destination
                    )

                    continue

            except Exception as e:

                log(
                    "Nested TAR warning: "
                    + str(e)
                )

    return locate_basicsr(
        search_root
    )


# ============================================================
# PREPARE BASICSR
# ============================================================

log(
    "Preparing BasicSR..."
)

BASICSR_ROOT = None

# Don't unnecessarily destroy a valid existing extraction.
if os.path.isdir(
    TEMP_BASICSR
):

    BASICSR_ROOT = locate_basicsr(
        TEMP_BASICSR
    )


if BASICSR_ROOT is None:

    if os.path.exists(
        TEMP_BASICSR
    ):

        shutil.rmtree(
            TEMP_BASICSR
        )

    os.makedirs(
        TEMP_BASICSR,
        exist_ok=True
    )

    if not os.path.isfile(
        BASICSR_ZIP
    ):

        raise RuntimeError(
            "BasicSR archive not found:\n"
            + BASICSR_ZIP
        )

    extract_zip_linux(
        BASICSR_ZIP,
        TEMP_BASICSR
    )

    BASICSR_ROOT = locate_basicsr(
        TEMP_BASICSR
    )


if BASICSR_ROOT is None:

    log(
        "BasicSR source not found directly."
    )

    log(
        "Checking nested archives..."
    )

    BASICSR_ROOT = extract_nested_archives(
        TEMP_BASICSR
    )


if BASICSR_ROOT is None:

    log(
        "BasicSR source still not found."
    )

    for root, dirs, files in os.walk(
        TEMP_BASICSR
    ):

        for filename in files:

            log(
                os.path.join(
                    root,
                    filename
                )
            )

    raise RuntimeError(
        "Could not locate BasicSR source "
        "after ZIP/TAR extraction."
    )


BASICSR_INIT = os.path.join(
    BASICSR_ROOT,
    "basicsr",
    "__init__.py"
)


if not os.path.isfile(
    BASICSR_INIT
):

    raise RuntimeError(
        "BasicSR verification failed:\n"
        + BASICSR_INIT
    )


if BASICSR_ROOT not in sys.path:

    sys.path.insert(
        0,
        BASICSR_ROOT
    )


log(
    "BasicSR root: "
    + BASICSR_ROOT
)

log(
    "BasicSR verified: "
    + BASICSR_INIT
)


# ============================================================
# TORCHVISION COMPATIBILITY
# ============================================================

log(
    "Applying TorchVision compatibility..."
)

try:

    import torchvision
    import torchvision.transforms.functional as TF

    module_name = (
        "torchvision.transforms.functional_tensor"
    )

    if module_name not in sys.modules:

        compatibility_module = types.ModuleType(
            module_name
        )

        if hasattr(
            TF,
            "rgb_to_grayscale"
        ):

            compatibility_module.rgb_to_grayscale = (
                TF.rgb_to_grayscale
            )

        sys.modules[
            module_name
        ] = compatibility_module

        log(
            "TorchVision functional_tensor "
            "compatibility installed."
        )

except Exception as e:

    log(
        "TorchVision compatibility warning: "
        + str(e)
    )


# ============================================================
# BASICSR IMPORT TEST
# ============================================================

log(
    "Testing BasicSR import..."
)

try:

    import basicsr

    log(
        "BasicSR import successful."
    )

except Exception as e:

    raise RuntimeError(
        "BasicSR import failed:\n"
        + str(e)
    )


# ============================================================
# PATCH SADTALKER NUMPY REFERENCES
# ============================================================

log(
    "Patching SadTalker NumPy compatibility..."
)


def patch_python_file(
    filepath
):

    try:

        with open(
            filepath,
            "r",
            encoding="utf-8"
        ) as f:

            content = f.read()

        original = content

        content = re.sub(
            r"np\.float\b",
            "np.float64",
            content
        )

        content = re.sub(
            r"np\.int\b",
            "np.int64",
            content
        )

        content = re.sub(
            r"np\.bool\b",
            "np.bool_",
            content
        )

        content = re.sub(
            r"np\.complex\b",
            "np.complex128",
            content
        )

        if content != original:

            with open(
                filepath,
                "w",
                encoding="utf-8"
            ) as f:

                f.write(
                    content
                )

    except Exception:
        pass


for root, dirs, files in os.walk(
    SADTALKER_DIR
):

    for filename in files:

        if filename.endswith(
            ".py"
        ):

            patch_python_file(
                os.path.join(
                    root,
                    filename
                )
            )


# ============================================================
# FACE3D TRANS_PARAMS FIX
# ============================================================

log(
    "Checking Face3D compatibility..."
)

PREPROCESS_FILE = os.path.join(
    SADTALKER_DIR,
    "src",
    "face3d",
    "util",
    "preprocess.py"
)


if os.path.isfile(
    PREPROCESS_FILE
):

    try:

        with open(
            PREPROCESS_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            content = f.read()

        # Handle the original problematic form.
        pattern = re.compile(
            r"trans_params\s*=\s*np\.array\s*\(\s*"
            r"\[\s*"
            r"w0\s*,\s*"
            r"h0\s*,\s*"
            r"s\s*,\s*"
            r"t\[0\]\s*,\s*"
            r"t\[1\]\s*"
            r"\]\s*\)"
        )

        replacement = """trans_params = np.array([
    float(np.asarray(w0).reshape(-1)[0]),
    float(np.asarray(h0).reshape(-1)[0]),
    float(np.asarray(s).reshape(-1)[0]),
    float(np.asarray(t[0]).reshape(-1)[0]),
    float(np.asarray(t[1]).reshape(-1)[0])
])"""

        new_content, count = pattern.subn(
            replacement,
            content
        )

        if count > 0:

            with open(
                PREPROCESS_FILE,
                "w",
                encoding="utf-8"
            ) as f:

                f.write(
                    new_content
                )

            log(
                "Applied Face3D trans_params fix."
            )

        else:

            log(
                "Face3D trans_params already patched "
                "or source differs."
            )

    except Exception as e:

        log(
            "Face3D patch warning: "
            + str(e)
        )


# ============================================================
# MY AWING NUMPY FIX
# ============================================================

MYAWING_FILE = os.path.join(
    SADTALKER_DIR,
    "src",
    "face3d",
    "util",
    "my_awing_arch.py"
)


if os.path.isfile(
    MYAWING_FILE
):

    try:

        with open(
            MYAWING_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            content = f.read()

        original = content

        content = re.sub(
            r"np\.float\b",
            "np.float64",
            content
        )

        if content != original:

            with open(
                MYAWING_FILE,
                "w",
                encoding="utf-8"
            ) as f:

                f.write(
                    content
                )

            log(
                "Applied my_awing_arch NumPy fix."
            )

    except Exception as e:

        log(
            "my_awing_arch patch warning: "
            + str(e)
        )


# ============================================================
# SADTALKER MODELS
# ============================================================

log(
    "Preparing SadTalker models..."
)

from huggingface_hub import hf_hub_download


os.makedirs(
    CHECKPOINT_DIR,
    exist_ok=True
)


MODEL_FILES = [
    "mapping_00109-model.pth.tar",
    "mapping_00229-model.pth.tar",
    "SadTalker_V0.0.2_256.safetensors"
]


def ensure_model(
    filename
):

    destination = os.path.join(
        CHECKPOINT_DIR,
        filename
    )

    # --------------------------------------------------------
    # Existing local model
    # --------------------------------------------------------

    if (
        os.path.isfile(destination)
        and os.path.getsize(destination) > 1024
    ):

        log(
            "Model already exists: "
            + filename
        )

        return destination

    # --------------------------------------------------------
    # Hugging Face cache
    # --------------------------------------------------------

    log(
        "Checking Hugging Face cache: "
        + filename
    )

    downloaded = hf_hub_download(
        repo_id=MODEL_REPO_ID,
        repo_type="dataset",
        filename=filename
    )

    # --------------------------------------------------------
    # Copy into SadTalker checkpoint directory
    # --------------------------------------------------------

    shutil.copy2(
        downloaded,
        destination
    )

    log(
        "Model ready: "
        + filename
    )

    return destination


for filename in MODEL_FILES:

    ensure_model(
        filename
    )


# ============================================================
# VERIFY MODELS
# ============================================================

for filename in MODEL_FILES:

    path = os.path.join(
        CHECKPOINT_DIR,
        filename
    )

    if not os.path.isfile(
        path
    ):

        raise RuntimeError(
            "Missing model:\n"
            + path
        )

    size_mb = (
        os.path.getsize(path)
        / 1024
        / 1024
    )

    log(
        f"Verified model: "
        f"{filename} "
        f"({size_mb:.1f} MB)"
    )


# ============================================================
# SADTALKER WORKING DIRECTORY
# ============================================================

os.chdir(
    SADTALKER_DIR
)


# Critical:
# Make /app/SadTalker explicitly importable.
if SADTALKER_DIR not in sys.path:

    sys.path.insert(
        0,
        SADTALKER_DIR
    )


log(
    "Working directory: "
    + os.getcwd()
)

log(
    "SadTalker directory in sys.path: "
    + str(
        SADTALKER_DIR in sys.path
    )
)


SRC_DIR = os.path.join(
    SADTALKER_DIR,
    "src"
)

GRADIO_DEMO_FILE = os.path.join(
    SRC_DIR,
    "gradio_demo.py"
)


log(
    "SadTalker src exists: "
    + str(
        os.path.isdir(SRC_DIR)
    )
)

log(
    "gradio_demo.py exists: "
    + str(
        os.path.isfile(GRADIO_DEMO_FILE)
    )
)


if not os.path.isdir(
    SRC_DIR
):

    raise RuntimeError(
        "SadTalker src directory not found:\n"
        + SRC_DIR
    )


if not os.path.isfile(
    GRADIO_DEMO_FILE
):

    raise RuntimeError(
        "SadTalker gradio_demo.py not found:\n"
        + GRADIO_DEMO_FILE
    )


# ============================================================
# SADTALKER IMPORT
# ============================================================

log(
    "Importing SadTalker..."
)

from src.gradio_demo import SadTalker

log(
    "SadTalker import successful."
)


# ============================================================
# INITIALIZE SADTALKER — ONCE ONLY
# ============================================================

log(
    "Initializing SadTalker..."
)

sadtalker = SadTalker()

log(
    "SadTalker initialized successfully."
)


# ============================================================
# SAVE GRADIO UPLOAD TO OUR OWN TEMP DIRECTORY
# ============================================================

def save_uploaded_file(
    uploaded,
    prefix
):

    if uploaded is None:

        raise ValueError(
            f"No {prefix} was uploaded."
        )

    source_path = None

    # Gradio filepath
    if isinstance(
        uploaded,
        str
    ):

        source_path = uploaded

    # Gradio dictionary
    elif isinstance(
        uploaded,
        dict
    ):

        source_path = uploaded.get(
            "path"
        )

        if source_path is None:

            source_path = uploaded.get(
                "name"
            )

    # FileData / similar object
    elif hasattr(
        uploaded,
        "path"
    ):

        source_path = uploaded.path

    elif hasattr(
        uploaded,
        "name"
    ):

        source_path = uploaded.name

    if not source_path:

        raise ValueError(
            f"Could not determine uploaded "
            f"{prefix} file path."
        )

    source_path = os.path.abspath(
        source_path
    )

    log(
        f"{prefix} received: "
        + source_path
    )

    if not os.path.isfile(
        source_path
    ):

        raise FileNotFoundError(
            f"Uploaded {prefix} file no longer exists:\n"
            + source_path
        )

    extension = os.path.splitext(
        source_path
    )[1]

    if not extension:

        extension = ".tmp"

    destination = os.path.join(
        USER_INPUT_DIR,
        f"{prefix}_{uuid.uuid4().hex}{extension}"
    )

    shutil.copy2(
        source_path,
        destination
    )

    log(
        f"{prefix} copied to: "
        + destination
    )

    return destination


# ============================================================
# GPU MEMORY CLEANUP
# ============================================================

def cleanup_gpu():

    try:

        import gc
        import torch

        gc.collect()

        if torch.cuda.is_available():

            torch.cuda.empty_cache()

            try:

                torch.cuda.ipc_collect()

            except Exception:

                pass

        log(
            "GPU memory cleanup completed."
        )

    except Exception as e:

        log(
            "GPU cleanup warning: "
            + str(e)
        )


# ============================================================
# ZERO GPU GENERATION
# ============================================================

@spaces.GPU
def generate_video(
    source_image,
    driven_audio,
    preprocess,
    still_mode,
    enhancer,
    batch_size,
    resolution,
    pose_style,
    expression_scale
):

    image_path = None
    audio_path = None

    try:

        # ----------------------------------------------------
        # INPUT VALIDATION
        # ----------------------------------------------------

        if source_image is None:

            raise gr.Error(
                "Please upload a narrator image."
            )

        if driven_audio is None:

            raise gr.Error(
                "Please upload narration audio."
            )

        # ----------------------------------------------------
        # Import torch only during GPU execution
        # ----------------------------------------------------

        import torch

        log(
            "=========================================="
        )

        log(
            "ZeroGPU execution started."
        )

        log(
            "CUDA available: "
            + str(
                torch.cuda.is_available()
            )
        )

        if torch.cuda.is_available():

            log(
                "GPU: "
                + torch.cuda.get_device_name(0)
            )

        # ----------------------------------------------------
        # COPY UPLOADED FILES
        # ----------------------------------------------------

        image_path = save_uploaded_file(
            source_image,
            "narrator_image"
        )

        audio_path = save_uploaded_file(
            driven_audio,
            "narration_audio"
        )

        # ----------------------------------------------------
        # SETTINGS
        # ----------------------------------------------------

        batch_size = max(
            1,
            min(
                4,
                int(batch_size)
            )
        )

        resolution = int(
            resolution
        )

        if resolution not in [
            256,
            512
        ]:

            resolution = 256

        pose_style = max(
            0,
            min(
                45,
                int(pose_style)
            )
        )

        expression_scale = max(
            0.5,
            min(
                2.0,
                float(expression_scale)
            )
        )

        # ----------------------------------------------------
        # LOG SETTINGS
        # ----------------------------------------------------

        log(
            "Image: "
            + image_path
        )

        log(
            "Audio: "
            + audio_path
        )

        log(
            f"Face preprocess: {preprocess}"
        )

        log(
            f"Resolution: {resolution}"
        )

        log(
            f"Pose style: {pose_style}"
        )

        log(
            f"Expression scale: "
            f"{expression_scale}"
        )

        log(
            f"Batch size: {batch_size}"
        )

        log(
            f"Still mode: {still_mode}"
        )

        log(
            f"Face enhancer: {enhancer}"
        )

        # ----------------------------------------------------
        # GENERATE
        # ----------------------------------------------------

        log(
            "Starting SadTalker generation..."
        )

        result = sadtalker.test(

            source_image=image_path,

            driven_audio=audio_path,

            preprocess=preprocess,

            still_mode=still_mode,

            use_enhancer=enhancer,

            batch_size=batch_size,

            size=resolution,

            pose_style=pose_style,

            # SadTalker uses exp_scale,
            # not expression_scale.
            exp_scale=expression_scale
        )

        # ----------------------------------------------------
        # RESULT VALIDATION
        # ----------------------------------------------------

        if not result:

            raise gr.Error(
                "SadTalker returned no video."
            )

        # Some versions may return a list/tuple.
        if isinstance(
            result,
            (list, tuple)
        ):

            if len(result) == 0:

                raise gr.Error(
                    "SadTalker returned an empty result."
                )

            result = result[-1]

        result = os.path.abspath(
            str(result)
        )

        if not os.path.isfile(
            result
        ):

            raise gr.Error(
                "SadTalker reported a video path, "
                "but the output file was not found:\n"
                + result
            )

        output_size_mb = (
            os.path.getsize(result)
            / 1024
            / 1024
        )

        log(
            "Generation complete."
        )

        log(
            "Output: "
            + result
        )

        log(
            f"Output size: "
            f"{output_size_mb:.2f} MB"
        )

        # ----------------------------------------------------
        # RETURN
        #
        # 1. Video preview
        # 2. Downloadable file
        # ----------------------------------------------------

        return (
            result,
            result
        )

    except gr.Error:

        raise

    except Exception as e:

        log(
            "Generation error: "
            + repr(e)
        )

        raise gr.Error(
            "Generation failed: "
            + str(e)
        )

    finally:

        # ----------------------------------------------------
        # CLEAN TEMP INPUT FILES
        # ----------------------------------------------------

        for path in [
            image_path,
            audio_path
        ]:

            try:

                if (
                    path
                    and os.path.isfile(path)
                ):

                    os.remove(
                        path
                    )

                    log(
                        "Removed temporary input: "
                        + path
                    )

            except Exception as cleanup_error:

                log(
                    "Input cleanup warning: "
                    + str(cleanup_error)
                )

        # ----------------------------------------------------
        # FREE GPU MEMORY
        # ----------------------------------------------------

        cleanup_gpu()


# ============================================================
# USER INTERFACE
# ============================================================

with gr.Blocks(
    title="SadTalker — ZeroGPU"
) as demo:

    # ========================================================
    # HEADER
    # ========================================================

    gr.Markdown(
        """
# 🎙️ SadTalker — ZeroGPU

Create a talking narrator video from a still image and
Chatterbox narration audio.

### Workflow

**Narrator Image → Chatterbox WAV → SadTalker → Talking-Head Video**

Designed for documentary, horror and narration workflows.
"""
    )

    # ========================================================
    # MAIN INPUT AREA
    # ========================================================

    with gr.Row():

        # ----------------------------------------------------
        # NARRATOR
        # ----------------------------------------------------

        with gr.Column(
            scale=1
        ):

            gr.Markdown(
                "## 🎭 Narrator"
            )

            source_image = gr.Image(
                type="filepath",
                label="Narrator Image",
                height=420
            )

            gr.Markdown(
                "Front-facing image recommended. "
                "Keep the mouth and both eyes clearly visible."
            )

            driven_audio = gr.Audio(
                type="filepath",
                label="Narration Audio",
                format="wav"
            )

            gr.Markdown(
                "Upload the Chatterbox WAV for this clip."
            )

        # ----------------------------------------------------
        # SETTINGS
        # ----------------------------------------------------

        with gr.Column(
            scale=1
        ):

            gr.Markdown(
                "## ⚙️ Generation Settings"
            )

            preprocess = gr.Dropdown(
                choices=[
                    "crop",
                    "resize",
                    "full",
                    "extcrop"
                ],
                value="crop",
                label="Face Preprocess"
            )

            resolution = gr.Radio(
                choices=[
                    256,
                    512
                ],
                value=256,
                label="Output Resolution"
            )

            pose_style = gr.Slider(
                minimum=0,
                maximum=45,
                value=0,
                step=1,
                label="Pose Style"
            )

            expression_scale = gr.Slider(
                minimum=0.5,
                maximum=2.0,
                value=1.0,
                step=0.1,
                label="Expression Scale"
            )

            batch_size = gr.Slider(
                minimum=1,
                maximum=4,
                value=2,
                step=1,
                label="Batch Size"
            )

            still_mode = gr.Checkbox(
                value=False,
                label="Still Mode"
            )

            enhancer = gr.Checkbox(
                value=False,
                label="Face Enhancer"
            )

    # ========================================================
    # SETTINGS GUIDE
    # ========================================================

    with gr.Accordion(
        "📖 Recommended Settings",
        open=True
    ):

        gr.Markdown(
            """
### 🎬 Recommended for your Mr Nightmare narrator

| Setting | Recommended |
|---|---|
| Face Preprocess | `crop` |
| Resolution | `256` |
| Pose Style | `0` |
| Expression Scale | `1.0` |
| Batch Size | `2` |
| Still Mode | OFF |
| Face Enhancer | OFF |

### For your first test

Use a **10–20 second WAV**.

Once the result looks good, move to longer narration clips.

### Resolution

**256** → faster and much lighter on ZeroGPU.

**512** → higher resolution but considerably more GPU
memory/time.

### Pose Style

`0` gives the least additional head movement.

Higher values introduce more pose variation.

### Expression Scale

`1.0` is the neutral starting point.

Higher values increase facial expression.

### Face Enhancer

Keep this OFF for initial tests.

It can increase processing time considerably.
"""
        )

    # ========================================================
    # GENERATE
    # ========================================================

    gr.Markdown(
        "## 🎬 Generate"
    )

    generate_button = gr.Button(
        "🎬 Generate Talking Video",
        variant="primary",
        size="lg"
    )

    # ========================================================
    # OUTPUT
    # ========================================================

    gr.Markdown(
        "## 🎥 Result"
    )

    output_video = gr.Video(
        label="Generated Talking-Head Video",
        autoplay=False,
        height=500
    )

    download_video = gr.File(
        label="⬇️ Download Generated Video",
        type="filepath"
    )

    # ========================================================
    # GENERATION EVENT
    # ========================================================

    generate_button.click(

        fn=generate_video,

        inputs=[
            source_image,
            driven_audio,
            preprocess,
            still_mode,
            enhancer,
            batch_size,
            resolution,
            pose_style,
            expression_scale
        ],

        outputs=[
            output_video,
            download_video
        ]
    )

    # ========================================================
    # FOOTER
    # ========================================================

    gr.Markdown(
        """
---

### 🎙️ Mr Nightmare Production Workflow

**1. Generate narration with Chatterbox**

**2. Upload narrator image**

**3. Upload the corresponding WAV**

**4. Adjust SadTalker settings**

**5. Generate the talking-head clip**

**6. Download the MP4**

**7. Combine narrator footage and B-roll in Kdenlive**

For a 15-minute documentary, generate separate narrator clips
for your narration sections instead of processing the entire
15-minute video in one request.
"""
    )


# ============================================================
# QUEUE + LAUNCH
# ============================================================

log(
    "Configuring Gradio queue..."
)

demo.queue(
    max_size=2
)

log(
    "Launching Gradio..."
)

demo.launch()