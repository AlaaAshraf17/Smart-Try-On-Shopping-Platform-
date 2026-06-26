"""
Flask API Server — Glasses Try-On Only
"""

import base64
import os
import time
import urllib.request

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

from try_on.face_tracker    import FaceTracker
from try_on.glasses_overlay import load_glasses, prepare_glasses, overlay_glasses
from try_on.Smoother        import LandmarkSmoother

app = Flask(__name__)
CORS(app)

print(f"[Worker {os.getpid()}] Loading MediaPipe face model...")
face_tracker = FaceTracker()
print(f"[Worker {os.getpid()}] Model loaded!")

_asset_cache: dict = {}
_glasses_smoother  = LandmarkSmoother(buffer_size=2)


# ── DictLandmarkSmoother ──────────────────────────────────────────────────────
# Face landmarks are dicts {"x": int, "y": int, "z": float}.
# Standard LandmarkSmoother only handles list/tuple [x, y].
# This smoother averages x, y, z independently across a rolling buffer.

class DictLandmarkSmoother:
    def __init__(self, buffer_size=2):
        self.buffer_size = buffer_size
        self.buffer = []

    def smooth(self, landmarks):
        if landmarks is None:
            self.buffer.clear()
            return None
        self.buffer.append(landmarks)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)
        averaged = {}
        for key in landmarks:
            xs = [f[key]["x"] for f in self.buffer]
            ys = [f[key]["y"] for f in self.buffer]
            zs = [f[key]["z"] for f in self.buffer]
            averaged[key] = {
                "x": int(sum(xs) / len(xs)),
                "y": int(sum(ys) / len(ys)),
                "z": round(sum(zs) / len(zs), 4),
            }
        return averaged

    def reset(self):
        self.buffer.clear()


_glasses_landmark_smoother = DictLandmarkSmoother(buffer_size=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_frame(b64_string: str) -> np.ndarray:
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_string)
    np_arr    = np.frombuffer(img_bytes, dtype=np.uint8)
    frame     = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image from base64 string")
    return frame


def _encode_frame(frame: np.ndarray, quality: int = 85) -> str:
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def _get_glasses_asset(url: str) -> tuple:
    if url in _asset_cache:
        return _asset_cache[url]
    print(f"  Downloading glasses asset: {url}")
    with urllib.request.urlopen(url, timeout=10) as response:
        png_bytes = response.read()
    np_arr  = np.frombuffer(png_bytes, dtype=np.uint8)
    img_raw = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
    if img_raw is None:
        raise ValueError(f"Could not decode PNG from URL: {url}")
    if img_raw.shape[2] == 3:
        alpha   = np.ones((*img_raw.shape[:2], 1), dtype=img_raw.dtype) * 255
        img_raw = np.concatenate([img_raw, alpha], axis=2)
    img_feathered = prepare_glasses(img_raw)
    result = (img_raw, img_feathered)
    _asset_cache[url] = result
    print(f"  Asset cached. Size: {img_raw.shape[1]}x{img_raw.shape[0]}px")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — Health Check
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status":        "ok",
        "models_loaded": True,
        "version":       "1.0.0",
        "endpoints": {
            "try_on_2d":     "POST /try-on",
            "glasses_3d":    "POST /try-on/glasses/landmarks",
            "reset":         "POST /try-on/reset",
        }
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — Glasses 2D Overlay
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on", methods=["POST"])
def try_on():
    t_start = time.time()

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "No JSON body received"}), 400

    frame_b64 = data.get("frame")
    asset_url = data.get("asset_url")

    if not frame_b64:
        return jsonify({"success": False, "error": "Missing 'frame' field"}), 400
    if not asset_url:
        return jsonify({"success": False, "error": "Missing 'asset_url' field"}), 400

    try:
        frame = _decode_frame(frame_b64)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame decode failed: {e}"}), 400

    fr_h, fr_w = frame.shape[:2]

    try:
        asset_orig, asset_feathered = _get_glasses_asset(asset_url)
    except Exception as e:
        return jsonify({"success": False, "error": f"Asset load failed: {e}"}), 400

    try:
        face_results = face_tracker.detect(frame)
    except Exception as e:
        return jsonify({"success": False, "error": f"Detection failed: {e}"}), 500

    landmarks = face_tracker.get_landmarks(face_results, fr_w, fr_h)
    detected  = landmarks is not None
    frame     = overlay_glasses(frame, landmarks, asset_orig, asset_feathered)

    try:
        result_b64 = _encode_frame(frame, quality=85)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame encode failed: {e}"}), 500

    fps = round(1 / max(time.time() - t_start, 1e-6), 1)
    return jsonify({"success": True, "frame": result_b64, "detected": detected, "fps": fps})


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3 — Glasses Landmarks (3D frontend)
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on/glasses/landmarks", methods=["POST"])
def glasses_landmarks():
    t_start = time.time()

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "No JSON body received"}), 400

    frame_b64 = data.get("frame")
    if not frame_b64:
        return jsonify({"success": False, "error": "Missing 'frame' field"}), 400

    try:
        frame = _decode_frame(frame_b64)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame decode failed: {e}"}), 400

    fr_h, fr_w = frame.shape[:2]

    try:
        face_results = face_tracker.detect(frame)
    except Exception as e:
        return jsonify({"success": False, "error": f"Detection failed: {e}"}), 500

    landmarks = face_tracker.get_landmarks(face_results, fr_w, fr_h)
    smooth_lm = _glasses_landmark_smoother.smooth(landmarks)

    fps = round(1 / max(time.time() - t_start, 1e-6), 1)

    if smooth_lm is None:
        return jsonify({
            "success":      True,
            "detected":     False,
            "landmarks":    None,
            "frame_width":  fr_w,
            "frame_height": fr_h,
            "fps":          fps,
        })

    return jsonify({
        "success":      True,
        "detected":     True,
        "landmarks":    smooth_lm,
        "frame_width":  fr_w,
        "frame_height": fr_h,
        "fps":          fps,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 4 — Reset Smoothers
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on/reset", methods=["POST"])
def reset():
    data        = request.get_json(silent=True) or {}
    clear_cache = data.get("clear_cache", False)

    import try_on.glasses_overlay as glasses_mod
    glasses_mod._smoother.reset()
    _glasses_landmark_smoother.reset()

    if clear_cache:
        _asset_cache.clear()
        print("Asset cache cleared")

    return jsonify({
        "success": True,
        "message": "Smoothers reset" + (" and cache cleared" if clear_cache else ""),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# SERVER STARTUP
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("─" * 50)
    print("  Smart Try-On AI Service — Glasses Only")
    print("─" * 50)
    print("  Health check   : http://localhost:5001/health")
    print("  Glasses (2D)   : POST http://localhost:5001/try-on")
    print("  Glasses (3D)   : POST http://localhost:5001/try-on/glasses/landmarks")
    print("  Reset          : POST http://localhost:5001/try-on/reset")
    print("─" * 50)
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)
