"""
Phase 6 — Flask API Server
The AI microservice that the Next.js frontend talks to.

Endpoints:
  GET  /health       → frontend checks the AI service is alive
  POST /try-on       → receives a camera frame + product info, returns processed frame
  POST /try-on/reset → resets smoothers when user switches products

How it works:
  1. Next.js sends a camera frame (base64 JPEG) + the product asset URL + type
  2. Flask decodes the frame, downloads and caches the asset PNG
  3. Runs the right tracker (body for shirt, face for glasses)
  4. Runs the right overlay
  5. Returns the processed frame as base64 back to Next.js
  6. Next.js puts it in an <img> tag — user sees the result instantly

Thread Safety:
  This app is designed to run with Gunicorn using PROCESS-BASED workers,
  not threads. Each worker process has its own copy of the MediaPipe models,
  eliminating race conditions. See gunicorn_config.py for worker settings.
"""

import base64
import io
import os
import time
import urllib.request

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

from try_on.body_tracker    import BodyTracker
from try_on.face_tracker    import FaceTracker
from try_on.shirt_overlay   import load_shirt, prepare_shirt, overlay_shirt
from try_on.glasses_overlay import load_glasses, prepare_glasses, overlay_glasses
from try_on.Smoother import LandmarkSmoother

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

# CORS = Cross-Origin Resource Sharing
# Without this, the browser BLOCKS requests from Next.js (localhost:3000)
# to Flask (localhost:5001) because they are different "origins".
# CORS(app) tells Flask to allow requests from any origin during development.
# In production you would restrict this to your actual domain.
CORS(app)

# ── Load AI models once per worker process ───────────────────────────────────
# IMPORTANT: These are loaded at MODULE LEVEL but Gunicorn uses PROCESS-BASED
# workers, not threads. Each worker process gets its own copy of these trackers,
# so there's no sharing or race conditions.
#
# Why not load per-request? Loading MediaPipe models takes ~1 second each.
# Loading once per worker = instant on every request.
#
# Worker lifecycle:
#   1. Gunicorn spawns worker process
#   2. Worker imports this module → trackers are created
#   3. Worker handles thousands of requests with same tracker instances
#   4. Worker dies after max_requests → new worker spawns with fresh trackers
print(f"[Worker {os.getpid()}] Loading MediaPipe models...")
body_tracker = BodyTracker()
face_tracker = FaceTracker()
print(f"[Worker {os.getpid()}] Models loaded!")

# ── Asset cache ───────────────────────────────────────────────────────────────
# When the frontend sends a shirt URL like:
#   "https://yourcdn.com/shirts/blue-tshirt.png"
# We download it and store it here. The next frame reuses the cached version.
# Without this cache, we'd download the PNG 15 times per second — very slow.
#
# Structure: { "https://...url": (original_ndarray, feathered_ndarray) }
_asset_cache: dict = {}

# ── Smoothers ─────────────────────────────────────────────────────────────────
# One smoother per tracker. These are module-level because they need to
# persist ACROSS frames — that's the whole point of smoothing.
# They are already created inside shirt_overlay.py and glasses_overlay.py,
# but we also keep one here for the reset endpoint.
_shirt_smoother   = LandmarkSmoother(buffer_size=5)
_glasses_smoother = LandmarkSmoother(buffer_size=4)

# Dedicated smoother for the new /try-on/glasses/landmarks endpoint.
# Kept separate so it doesn't interfere with the 2D overlay smoother
# if both endpoints are called in the same session.
_glasses_landmark_smoother = LandmarkSmoother(buffer_size=4)

# Dedicated smoother for the new /try-on/shirt/landmarks endpoint.
# Body landmarks are noisier than face landmarks so we use a slightly
# larger buffer (5 frames) for smoother shirt placement.
_shirt_landmark_smoother = LandmarkSmoother(buffer_size=5)


# ── Helper: decode incoming frame ─────────────────────────────────────────────
def _decode_frame(b64_string: str) -> np.ndarray:
    """
    Convert a base64 JPEG string (sent from the browser) into an OpenCV image.

    The browser captures a frame like this:
      const canvas = document.createElement('canvas')
      canvas.toDataURL('image/jpeg', 0.7)  →  "data:image/jpeg;base64,/9j/4AAQ..."

    We strip the "data:image/jpeg;base64," prefix, then:
      base64 string → raw bytes → numpy array → OpenCV BGR image

    Why JPEG? It's much smaller than PNG for real-time transfer.
    0.7 quality = good enough visually, small enough to send quickly.
    """
    # Strip the data URL prefix if present (browser includes it, some clients don't)
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    # Decode base64 → raw bytes
    img_bytes = base64.b64decode(b64_string)

    # Convert raw bytes → numpy array → OpenCV image
    np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
    frame  = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Could not decode image from base64 string")

    return frame


# ── Helper: encode result frame ───────────────────────────────────────────────
def _encode_frame(frame: np.ndarray, quality: int = 85) -> str:
    """
    Convert an OpenCV image back to a base64 JPEG string to send to the browser.

    The browser receives this and does:
      img.src = "data:image/jpeg;base64," + result.frame

    quality 85 = good visual quality, reasonable size.
    We use slightly higher quality on the result than the input (70 vs 85)
    because the overlay adds fine detail (shirt edges, glasses frames)
    that degrades badly at low quality.
    """
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


# ── Helper: load and cache asset ──────────────────────────────────────────────
def _get_asset(url: str, asset_type: str) -> tuple:
    """
    Download and cache a shirt or glasses PNG from a URL.

    First call:  downloads from URL, processes (feather edges), caches, returns
    Later calls: returns from cache instantly — no download needed

    asset_type: "shirt" or "glasses" — determines which loader to use
                (load_shirt vs load_glasses — they have different processing)

    Returns a tuple of (original, feathered) numpy arrays.
    """
    # Return cached version if we have it
    if url in _asset_cache:
        return _asset_cache[url]

    print(f"  Downloading asset: {url}")

    # Download the PNG from the URL into memory (no disk write)
    # urllib.request.urlopen() returns a file-like object
    # We read all bytes and wrap in BytesIO so OpenCV can read it
    with urllib.request.urlopen(url, timeout=10) as response:
        png_bytes = response.read()

    # Decode PNG bytes into a numpy array
    np_arr  = np.frombuffer(png_bytes, dtype=np.uint8)
    img_raw = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)

    if img_raw is None:
        raise ValueError(f"Could not decode PNG from URL: {url}")

    # Apply the right preparation depending on asset type
    if asset_type == "shirt":
        # load_shirt handles: BGRA channel check + vertical flip
        # But since we loaded manually, we do the same steps here
        if img_raw.shape[2] == 3:
            alpha   = np.ones((*img_raw.shape[:2], 1), dtype=img_raw.dtype) * 255
            img_raw = np.concatenate([img_raw, alpha], axis=2)
        img_raw      = cv2.flip(img_raw, 0)   # fix upside-down PNGs
        img_feathered = prepare_shirt(img_raw)

    elif asset_type == "glasses":
        if img_raw.shape[2] == 3:
            alpha   = np.ones((*img_raw.shape[:2], 1), dtype=img_raw.dtype) * 255
            img_raw = np.concatenate([img_raw, alpha], axis=2)
        img_feathered = prepare_glasses(img_raw)

    else:
        raise ValueError(f"Unknown asset_type: {asset_type}. Must be 'shirt' or 'glasses'")

    # Store in cache
    result = (img_raw, img_feathered)
    _asset_cache[url] = result
    print(f"  Asset cached. Size: {img_raw.shape[1]}x{img_raw.shape[0]}px")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — Health Check
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/health", methods=["GET"])
def health_check():
    """
    The frontend calls this first before opening the camera.
    If this returns 200, the AI service is running and ready.
    If it fails, the frontend shows "AI service unavailable" to the user.

    Returns:
      { "status": "ok", "models_loaded": true, "version": "1.0.0" }
    """
    return jsonify({
        "status":        "ok",
        "models_loaded": True,
        "version":       "1.0.0",
        "endpoints": {
            "try_on": "POST /try-on",
            "reset":  "POST /try-on/reset",
        }
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — Try-On (the main endpoint)
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on", methods=["POST"])
def try_on():
    """
    The core endpoint. Called by Next.js ~15 times per second (one per frame).

    Expected request body (JSON):
    {
      "frame":      "data:image/jpeg;base64,/9j/4AAQ...",  ← camera frame
      "type":       "shirt" | "glasses",                    ← what to overlay
      "asset_url":  "https://yourcdn.com/shirts/blue.png"  ← PNG to overlay
    }

    Returns (JSON):
    {
      "success": true,
      "frame":   "data:image/jpeg;base64,...",  ← processed frame
      "detected": true | false,                  ← did we find a body/face?
      "fps":      14.3                           ← processing speed
    }

    Or on error:
    {
      "success": false,
      "error":   "description of what went wrong"
    }

    Step by step:
      1. Parse and validate the incoming JSON
      2. Decode the base64 frame into an OpenCV image
      3. Download and cache the asset PNG
      4. Run the right tracker (body or face)
      5. Run the right overlay
      6. Encode the result back to base64
      7. Return JSON response
    """
    t_start = time.time()   # track processing time for FPS calculation

    # ── Step 1: Parse request ──────────────────────────────────────────────────
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "error": "No JSON body received"}), 400

    frame_b64  = data.get("frame")
    asset_type = data.get("type")
    asset_url  = data.get("asset_url")

    # Validate required fields
    if not frame_b64:
        return jsonify({"success": False, "error": "Missing 'frame' field"}), 400
    if asset_type not in ("shirt", "glasses"):
        return jsonify({"success": False, "error": "'type' must be 'shirt' or 'glasses'"}), 400
    if not asset_url:
        return jsonify({"success": False, "error": "Missing 'asset_url' field"}), 400

    # ── Step 2: Decode frame ───────────────────────────────────────────────────
    try:
        frame = _decode_frame(frame_b64)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame decode failed: {e}"}), 400

    fr_h, fr_w = frame.shape[:2]

    # ── Step 3: Load asset (from cache or download) ────────────────────────────
    try:
        asset_orig, asset_feathered = _get_asset(asset_url, asset_type)
    except Exception as e:
        return jsonify({"success": False, "error": f"Asset load failed: {e}"}), 400

    # ── Step 4 & 5: Detect + Overlay ──────────────────────────────────────────
    detected = False

    if asset_type == "shirt":
        # Run body tracker
        try:
            body_results = body_tracker.detect(frame)
        except Exception as e:
            return jsonify({"success": False, "error": f"Detection failed: {e}"}), 500

        landmarks = body_tracker.get_landmarks(body_results, fr_w, fr_h)
        detected  = landmarks is not None

        # overlay_shirt handles smoothing internally via its _smoother
        frame = overlay_shirt(frame, landmarks, asset_orig, asset_feathered)

    elif asset_type == "glasses":
        # Run face tracker
        try:
            face_results = face_tracker.detect(frame)
        except Exception as e:
            return jsonify({"success": False, "error": f"Detection failed: {e}"}), 500

        landmarks = face_tracker.get_landmarks(face_results, fr_w, fr_h)
        detected  = landmarks is not None

        # overlay_glasses handles smoothing internally via its _smoother
        frame = overlay_glasses(frame, landmarks, asset_orig, asset_feathered)

    # ── Step 6: Encode result ──────────────────────────────────────────────────
    try:
        result_b64 = _encode_frame(frame, quality=85)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame encode failed: {e}"}), 500

    # ── Step 7: Return response ────────────────────────────────────────────────
    processing_time = time.time() - t_start
    fps = round(1 / processing_time, 1) if processing_time > 0 else 0

    return jsonify({
        "success":  True,
        "frame":    result_b64,
        "detected": detected,
        "fps":      fps,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3 — Glasses Landmarks (for 3D frontend rendering)
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on/glasses/landmarks", methods=["POST"])
def glasses_landmarks():
    """
    Lightweight endpoint for 3D glasses try-on.
    The frontend handles all rendering (Three.js + .glb model).
    This endpoint only detects face landmarks and returns their pixel positions.

    Why a separate endpoint instead of reusing /try-on?
      - /try-on composites a 2D PNG onto the frame and returns a full JPEG.
        That image-encode/decode round-trip costs ~10ms and sends ~50KB per frame.
      - This endpoint returns a tiny JSON (~200 bytes) with just the coordinates.
        The frontend does the rendering with WebGL — no image transfer needed.
      - Keeping them separate means shirts still work exactly as before.

    Expected request body (JSON):
    {
      "frame": "data:image/jpeg;base64,/9j/4AAQ..."   ← camera frame (same as /try-on)
    }

    Returns on success (JSON):
    {
      "success":      true,
      "detected":     true,
      "landmarks": {
        "left_eye":        [423, 310],   ← pixel coords, origin = top-left of frame
        "right_eye":       [198, 308],
        "nose_bridge":     [312, 355],   ← landmark 168 — best vertical anchor for glasses
        "left_face_edge":  [521, 330],   ← temple anchor (landmark 234)
        "right_face_edge": [105, 328]    ← temple anchor (landmark 454)
      },
      "frame_width":  1280,              ← needed by frontend to normalise coords
      "frame_height": 720,
      "fps":          28.4
    }

    Returns when no face detected:
    {
      "success":  true,
      "detected": false,
      "landmarks": null,
      "frame_width":  1280,
      "frame_height": 720,
      "fps":          60.0
    }

    Returns on error:
    {
      "success": false,
      "error":   "description"
    }

    Coordinate system note for the frontend team:
      - Origin (0, 0) = top-left corner of the frame
      - x increases rightward, y increases downward  (standard image coords)
      - The frame is already mirrored on the frontend before sending,
        so left_eye is the user's left eye from THEIR perspective.
      - Divide x by frame_width and y by frame_height to get normalised [0,1] coords.
      - Landmarks are smoothed (4-frame rolling average) — no extra smoothing needed.
    """
    t_start = time.time()

    # ── Parse request ──────────────────────────────────────────────────────────
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "No JSON body received"}), 400

    frame_b64 = data.get("frame")
    if not frame_b64:
        return jsonify({"success": False, "error": "Missing 'frame' field"}), 400

    # ── Decode frame ───────────────────────────────────────────────────────────
    try:
        frame = _decode_frame(frame_b64)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame decode failed: {e}"}), 400

    fr_h, fr_w = frame.shape[:2]

    # ── Run face detection ─────────────────────────────────────────────────────
    try:
        face_results = face_tracker.detect(frame)
    except Exception as e:
        return jsonify({"success": False, "error": f"Detection failed: {e}"}), 500

    landmarks = face_tracker.get_landmarks(face_results, fr_w, fr_h)

    # ── Smooth landmarks ───────────────────────────────────────────────────────
    # Same 4-frame rolling average as the 2D overlay uses.
    # Gives the frontend stable coords without jitter.
    smooth_lm = _glasses_landmark_smoother.smooth(landmarks)

    # ── Build response ─────────────────────────────────────────────────────────
    processing_time = time.time() - t_start
    fps = round(1 / processing_time, 1) if processing_time > 0 else 0

    if smooth_lm is None:
        return jsonify({
            "success":      True,
            "detected":     False,
            "landmarks":    None,
            "frame_width":  fr_w,
            "frame_height": fr_h,
            "fps":          fps,
        })

    # Convert tuples to plain lists so JSON serialises cleanly: [x, y]
    landmarks_out = {key: list(pt) for key, pt in smooth_lm.items()}

    return jsonify({
        "success":      True,
        "detected":     True,
        "landmarks":    landmarks_out,
        "frame_width":  fr_w,
        "frame_height": fr_h,
        "fps":          fps,
    })



# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 4 — Shirt Landmarks (for 3D frontend rendering)
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on/shirt/landmarks", methods=["POST"])
def shirt_landmarks():
    """
    Lightweight endpoint for 3D shirt try-on.
    The frontend handles all rendering (Three.js + .glb model).
    This endpoint detects body pose landmarks and returns their pixel positions
    plus pre-computed measurements the frontend needs to size and orient the model.

    Why pre-computed measurements?
      Body landmarks alone give you 11 raw points. To place a 3D shirt the
      frontend also needs shoulder_width, torso_height, and torso_angle.
      Computing these here saves the frontend team from doing vector math
      and ensures the values are consistent with how the 2D overlay works.

    Expected request body (JSON):
    {
      "frame": "data:image/jpeg;base64,/9j/4AAQ..."
    }

    Returns on success (JSON):
    {
      "success":  true,
      "detected": true,
      "landmarks": {
        "left_shoulder":  [x, y],   ← pixel coords, origin = top-left
        "right_shoulder": [x, y],
        "left_elbow":     [x, y],   ← needed to orient sleeve arms
        "right_elbow":    [x, y],
        "left_wrist":     [x, y],   ← needed for full sleeve length
        "right_wrist":    [x, y],
        "left_hip":       [x, y],   ← hem anchor
        "right_hip":      [x, y],
        "left_ear":       [x, y],   ← collar height reference
        "right_ear":      [x, y],
        "nose":           [x, y]    ← head center reference
      },
      "measurements": {
        "shoulder_width":  312,     ← pixel distance left→right shoulder
        "torso_height":    280,     ← pixel distance shoulder-mid→hip-mid
        "torso_angle_deg": -2.4,    ← tilt of shoulder line in degrees
                                       0=level, +ve=tilted right, -ve=tilted left
        "shoulder_mid":   [x, y],  ← midpoint between shoulders (shirt center)
        "hip_mid":        [x, y]   ← midpoint between hips (hem center)
      },
      "frame_width":  640,
      "frame_height": 480,
      "fps": 45.2
    }

    Returns when no body detected:
    {
      "success":  true,
      "detected": false,
      "landmarks":    null,
      "measurements": null,
      "frame_width":  640,
      "frame_height": 480,
      "fps": 60.0
    }

    Coordinate system note for the frontend team:
      - Origin (0, 0) = top-left corner of the frame
      - x increases rightward, y increases downward (standard image coords)
      - Frame is already mirrored — left_shoulder is the user's left shoulder
      - Divide x by frame_width, y by frame_height for normalised [0, 1] coords
      - All landmarks are smoothed (5-frame rolling average)
      - torso_angle_deg: use this to rotate the 3D shirt model around the Z axis
        so it stays aligned when the person tilts sideways
      - shoulder_width and torso_height are in pixels — divide by frame_width
        and frame_height respectively to get normalised scale factors
    """
    t_start = time.time()

    # ── Parse request ──────────────────────────────────────────────────────────
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "No JSON body received"}), 400

    frame_b64 = data.get("frame")
    if not frame_b64:
        return jsonify({"success": False, "error": "Missing 'frame' field"}), 400

    # ── Decode frame ───────────────────────────────────────────────────────────
    try:
        frame = _decode_frame(frame_b64)
    except Exception as e:
        return jsonify({"success": False, "error": f"Frame decode failed: {e}"}), 400

    fr_h, fr_w = frame.shape[:2]

    # ── Run body detection ─────────────────────────────────────────────────────
    try:
        body_results = body_tracker.detect(frame)
    except Exception as e:
        return jsonify({"success": False, "error": f"Detection failed: {e}"}), 500

    landmarks = body_tracker.get_landmarks(body_results, fr_w, fr_h)

    # ── Smooth landmarks ───────────────────────────────────────────────────────
    smooth_lm = _shirt_landmark_smoother.smooth(landmarks)

    # ── Build response ─────────────────────────────────────────────────────────
    processing_time = time.time() - t_start
    fps = round(1 / processing_time, 1) if processing_time > 0 else 0

    if smooth_lm is None:
        return jsonify({
            "success":      True,
            "detected":     False,
            "landmarks":    None,
            "measurements": None,
            "frame_width":  fr_w,
            "frame_height": fr_h,
            "fps":          fps,
        })

    # ── Compute measurements from smoothed landmarks ───────────────────────────
    # These are derived values the frontend needs to size and orient the 3D model.
    # We compute them here so the frontend team doesn't have to re-implement
    # the same vector math, and so they match exactly what the 2D overlay uses.
    ls = smooth_lm["left_shoulder"]
    rs = smooth_lm["right_shoulder"]
    lh = smooth_lm["left_hip"]
    rh = smooth_lm["right_hip"]

    # Shoulder width — Euclidean distance
    shoulder_width = round(
        ((rs[0] - ls[0]) ** 2 + (rs[1] - ls[1]) ** 2) ** 0.5
    )

    # Shoulder midpoint and hip midpoint
    shoulder_mid = [round((ls[0] + rs[0]) / 2), round((ls[1] + rs[1]) / 2)]
    hip_mid      = [round((lh[0] + rh[0]) / 2), round((lh[1] + rh[1]) / 2)]

    # Torso height — distance from shoulder mid to hip mid
    torso_height = round(
        ((hip_mid[0] - shoulder_mid[0]) ** 2 + (hip_mid[1] - shoulder_mid[1]) ** 2) ** 0.5
    )

    # Torso angle — tilt of the shoulder line from horizontal.
    #
    # The frame is horizontally mirrored (cv2.flip), so 'left_shoulder'
    # has a HIGHER pixel-x than 'right_shoulder' when the person stands
    # normally. Using (rs - ls) directly gives ~175 deg instead of ~5 deg
    # because the vector points LEFT in pixel space.
    #
    # Fix: always compute from the lower-x point to the higher-x point
    # (left-to-right in pixel space). Result is in (-90, +90) — exactly
    # what the 3D frontend needs to rotate the shirt model.
    import math
    if ls[0] < rs[0]:
        dx = rs[0] - ls[0]
        dy = rs[1] - ls[1]
    else:
        dx = ls[0] - rs[0]
        dy = ls[1] - rs[1]
    torso_angle_deg = round(math.degrees(math.atan2(dy, dx)), 2)

    # Convert tuples to plain lists for JSON serialisation
    landmarks_out    = {key: list(pt) for key, pt in smooth_lm.items()}
    measurements_out = {
        "shoulder_width":  shoulder_width,
        "torso_height":    torso_height,
        "torso_angle_deg": torso_angle_deg,
        "shoulder_mid":    shoulder_mid,
        "hip_mid":         hip_mid,
    }

    return jsonify({
        "success":      True,
        "detected":     True,
        "landmarks":    landmarks_out,
        "measurements": measurements_out,
        "frame_width":  fr_w,
        "frame_height": fr_h,
        "fps":          fps,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 5 — Reset Smoothers
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/try-on/reset", methods=["POST"])
def reset():
    """
    Called by the frontend when the user switches to a different product.

    Why is this needed?
    The landmark smoother keeps a buffer of the last 5 frame positions.
    If the user switches from a shirt to glasses, the smoother still has
    old body landmark positions in its buffer.
    When the glasses overlay starts, it reads those stale positions and
    the glasses jump to a wrong location for the first ~5 frames.

    Calling reset clears both smoother buffers so the next product
    starts fresh with no stale data.

    Also clears the asset cache if requested — useful during development
    when you're replacing PNG files and want Flask to re-download them.

    Expected request body (optional JSON):
    { "clear_cache": true }   ← also clear the asset cache

    Returns:
    { "success": true, "message": "Smoothers reset" }
    """
    data        = request.get_json(silent=True) or {}
    clear_cache = data.get("clear_cache", False)

    # Reset the smoother buffers inside the overlay modules
    # These are the module-level _smoother instances in shirt_overlay.py
    # and glasses_overlay.py — we import and reset them directly
    import try_on.shirt_overlay   as shirt_mod
    import try_on.glasses_overlay as glasses_mod

    shirt_mod._smoother.reset()
    glasses_mod._smoother.reset()
    _glasses_landmark_smoother.reset()   # also reset the 3D glasses landmark smoother
    _shirt_landmark_smoother.reset()      # also reset the 3D shirt landmark smoother

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
    print("  Smart Try-On AI Service — Phase 6")
    print("─" * 50)
    print("  Health check   : http://localhost:5001/health")
    print("  Try-on (2D)    : POST http://localhost:5001/try-on")
    print("  Glasses (3D)   : POST http://localhost:5001/try-on/glasses/landmarks")
    print("  Shirt (3D)     : POST http://localhost:5001/try-on/shirt/landmarks")
    print("  Reset          : POST http://localhost:5001/try-on/reset")
    print("─" * 50)

    # debug=False in production — debug mode reloads models on every change
    # which is slow. Use True during development only.
    # threaded=True allows Flask to handle multiple requests at the same time.
    # Without it, if two frames arrive simultaneously, one waits for the other.
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True,
        threaded=True,
    )