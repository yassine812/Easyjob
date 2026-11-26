"""Bundle checksum-pinned CPU face models before runtime (Docker or local dev)."""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import shutil
import time
from urllib.request import urlopen

# OpenFace's official get-models.sh publishes MD5 c95bfd8cc1adf05210e979ff623013b6.
# The SHA-256 below was verified against that official download. YuNet's hash is
# the Git LFS object ID published by OpenCV at the pinned repository revision.
MODELS = (
    ("openface.nn4.small2.v1.t7", "https://storage.cmusatyalab.org/openface-models/nn4.small2.v1.t7",
     "9b72d54aeb24a64a8135dca8e792f7cc675c99a884a6940350a6cedcf7b7ba08"),
    ("face_detection_yunet_2023mar.onnx",
     "https://media.githubusercontent.com/media/opencv/opencv_zoo/f12e12798e8314f7c074a6656816c048dcc95b7a/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
     "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"),
)


def digest(file: Path) -> str:
    checksum = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def cache_model(target: Path, url: str, expected: str) -> None:
    if target.is_file() and digest(target) == expected:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".download")
    for attempt in range(3):
        try:
            with urlopen(url, timeout=90) as response, temporary.open("wb") as output:
                shutil.copyfileobj(response, output)
            if digest(temporary) != expected:
                raise ValueError(f"Checksum mismatch for {target.name}")
            temporary.replace(target)
            return
        except Exception:
            temporary.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, default=Path(__file__).resolve().parents[1] / "app" / "face" / "models")
    args = parser.parse_args()
    for filename, url, expected in MODELS:
        cache_model(args.target / filename, url, expected)
        print(f"Verified face model: {filename}")


if __name__ == "__main__":
    main()
