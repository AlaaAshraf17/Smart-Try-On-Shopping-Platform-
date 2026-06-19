"""
Download MediaPipe model files required by the AI service.

These files are excluded from git (.gitignore) because they are large binaries
(~10-50MB each). Run this script once after cloning the repo.

Usage:
    python download_models.py
"""

import os
import urllib.request

MODELS = [
    {
        "filename": "face_landmarker.task",
        "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        "description": "Face landmark detection (468 points)",
    },
]


def download(filename, url, description):
    if os.path.exists(filename):
        size_mb = round(os.path.getsize(filename) / 1024 / 1024, 1)
        print(f"  [✓] {filename} already exists ({size_mb} MB) — skipping")
        return

    print(f"  Downloading {filename}  ({description})...")
    try:
        urllib.request.urlretrieve(url, filename)
        size_mb = round(os.path.getsize(filename) / 1024 / 1024, 1)
        print(f"  [✓] {filename} downloaded ({size_mb} MB)")
    except Exception as e:
        print(f"  [✗] Failed to download {filename}: {e}")
        raise


if __name__ == "__main__":
    print("─" * 50)
    print("  Smart Try-On — Download MediaPipe Models")
    print("─" * 50)
    for model in MODELS:
        download(model["filename"], model["url"], model["description"])
    print("─" * 50)
    print("  All models ready. You can now run: python main.py")
    print("─" * 50)
