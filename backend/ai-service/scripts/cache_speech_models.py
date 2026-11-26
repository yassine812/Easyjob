"""Prepare a pinned multilingual Whisper-small model for offline CPU speech."""
from __future__ import annotations
import argparse
import os
from pathlib import Path
from cache_face_models import cache_model

REVISION = '536b0662742c02347bc0e980a01041f333bce120'
BASE = f'https://huggingface.co/Systran/faster-whisper-small/resolve/{REVISION}/'
FILES = {
    'model.bin': '3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671',
    'config.json': 'b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828',
    'tokenizer.json': 'fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab',
    'vocabulary.txt': '34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913',
    'README.md': '329373481008c7c38654aff8ecdcf0163c211557cc7ba8e2ef6f2f84b4f75ec8',
}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', type=Path, default=Path(os.getenv('FASTER_WHISPER_MODEL_PATH', '/models/faster-whisper-small')))
    args = parser.parse_args()
    for name, checksum in FILES.items():
        cache_model(args.target / name, BASE + name, checksum)
        print(f'Verified local speech model file: {name}', flush=True)
