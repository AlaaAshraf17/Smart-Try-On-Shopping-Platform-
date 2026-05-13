"""
Test script for POST /try-on/glasses/landmarks

Runs three tests against a live Flask server:
  1. Happy path  — real webcam frame → expect detected=True and 5 landmark keys
  2. No face     — blank white frame  → expect detected=False, landmarks=null
  3. Bad input   — garbage base64     → expect success=False and an error key

Usage:
  1. Start the Flask server first:   python main.py
  2. Then run this script:           python test_landmarks_endpoint.py

Requires: requests, opencv-python (both already in requirements.txt)
"""

import base64
import json
import sys
import time

import cv2
import numpy as np
import requests

SERVER = "http://localhost:5001"
URL    = f"{SERVER}/try-on/glasses/landmarks"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

results = []


# ── Helper: encode a numpy frame to base64 JPEG (same as the browser does) ───
def encode_frame(frame: np.ndarray, quality: int = 70) -> str:
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def run_test(name: str, payload: dict, check_fn):
    """Send payload, run check_fn(response_dict), print result."""
    print(f"\n  Running: {name}")
    try:
        t0  = time.time()
        r   = requests.post(URL, json=payload, timeout=10)
        ms  = round((time.time() - t0) * 1000)
        data = r.json()
        ok, reason = check_fn(r.status_code, data)
    except Exception as e:
        ok, reason, ms, data = False, str(e), 0, {}

    icon = PASS if ok else FAIL
    print(f"  {icon} {name}  ({ms} ms)")
    if not ok:
        print(f"     Reason : {reason}")
        print(f"     Response: {json.dumps(data, indent=6)}")
    else:
        # Print the key fields so you can eyeball them
        if data.get("detected"):
            lm = data.get("landmarks", {})
            print(f"     detected     = True")
            print(f"     frame size   = {data.get('frame_width')}×{data.get('frame_height')}")
            print(f"     fps          = {data.get('fps')}")
            for k, v in lm.items():
                print(f"     {k:<20} = {v}")
        else:
            print(f"     detected = False (landmarks = null)  ← correct for blank frame")

    results.append(ok)
    return ok


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1 — Real webcam frame (face must be visible)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "─" * 55)
print("  TEST 1 — Real webcam frame")
print("  SIT IN FRONT OF YOUR CAMERA and press Enter...")
input("  ▶ ")

cap = cv2.VideoCapture(0)
ret, frame = cap.read()
cap.release()

if not ret:
    print(f"  {FAIL} Could not open webcam — skipping test 1")
    results.append(False)
else:
    frame = cv2.flip(frame, 1)   # mirror, same as the browser does
    payload = {"frame": encode_frame(frame)}

    def check_happy(status, data):
        if status != 200:
            return False, f"HTTP {status}"
        if not data.get("success"):
            return False, f"success=False: {data.get('error')}"
        if not data.get("detected"):
            return False, "detected=False — no face found. Make sure you're in frame!"
        lm = data.get("landmarks", {})
        expected_keys = {"left_eye", "right_eye", "nose_bridge", "left_face_edge", "right_face_edge"}
        missing = expected_keys - set(lm.keys())
        if missing:
            return False, f"Missing landmark keys: {missing}"
        # Each value should be a 2-element list of ints
        for k, v in lm.items():
            if not (isinstance(v, list) and len(v) == 2):
                return False, f"landmark '{k}' is not a [x, y] list: {v}"
        if not data.get("frame_width") or not data.get("frame_height"):
            return False, "Missing frame_width / frame_height"
        return True, "ok"

    run_test("Happy path — face detected", payload, check_happy)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2 — Blank white frame (no face → detected must be False)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "─" * 55)
print("  TEST 2 — Blank frame (no face)")

blank = np.ones((480, 640, 3), dtype=np.uint8) * 255   # pure white
payload_blank = {"frame": encode_frame(blank)}

def check_no_face(status, data):
    if status != 200:
        return False, f"HTTP {status}"
    if not data.get("success"):
        return False, f"success=False: {data.get('error')}"
    if data.get("detected"):
        return False, "detected=True on a blank frame — something is wrong"
    if data.get("landmarks") is not None:
        return False, f"landmarks should be null but got: {data.get('landmarks')}"
    return True, "ok"

run_test("No face — blank white frame", payload_blank, check_no_face)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3 — Bad input (garbage base64)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "─" * 55)
print("  TEST 3 — Bad input")

payload_bad = {"frame": "data:image/jpeg;base64,NOT_VALID_BASE64!!!"}

def check_bad_input(status, data):
    if status not in (400, 500):
        return False, f"Expected 4xx/5xx for bad input, got HTTP {status}"
    if data.get("success"):
        return False, "success=True on garbage input — should have errored"
    if not data.get("error"):
        return False, "No 'error' key in response"
    return True, "ok"

run_test("Bad input — garbage base64", payload_bad, check_bad_input)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4 — Missing frame field
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "─" * 55)
print("  TEST 4 — Missing 'frame' field")

def check_missing_field(status, data):
    if status != 400:
        return False, f"Expected 400, got {status}"
    if data.get("success"):
        return False, "success=True on missing field"
    return True, "ok"

run_test("Missing frame field", {}, check_missing_field)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5 — Speed test (keep-alive session, 10 frames)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "─" * 55)
print("  TEST 5 — Speed test (keep-alive, 10 frames, must average < 100ms)")
print()
print("  Note: tests 1-4 show ~2000ms each because every run_test() opens a")
print("  brand-new TCP connection. That is Windows localhost TCP overhead —")
print("  not server slowness. The server already reported fps=50 (~20ms).")
print("  This test uses a persistent session, same as the browser does.")

if ret:
    payload_speed = {"frame": encode_frame(frame)}
    session = requests.Session()

    # One warm-up request (first connection is always slower)
    session.post(URL, json=payload_speed, timeout=10)

    times      = []
    fps_values = []
    for i in range(10):
        t0 = time.time()
        r  = session.post(URL, json=payload_speed, timeout=10)
        times.append((time.time() - t0) * 1000)
        d = r.json()
        if d.get("fps"):
            fps_values.append(d["fps"])

    session.close()

    avg        = round(sum(times) / len(times))
    mx         = round(max(times))
    server_fps = round(sum(fps_values) / len(fps_values), 1) if fps_values else 0
    server_ms  = round(1000 / server_fps) if server_fps else 0

    print(f"\n  Client round-trip : avg {avg} ms   max {mx} ms")
    print(f"  Server processing : {server_fps} fps  ({server_ms} ms per frame)")

    ok   = avg < 100
    icon = PASS if ok else FAIL
    print(f"  {icon} Speed test  (avg {avg} ms round-trip)")
    if not ok:
        print(f"     Round-trip > 100ms even with keep-alive.")
        print(f"     Server fps={server_fps} — if >15 the AI processing is fine.")
        print(f"     Remaining latency is Windows localhost TCP — not a real issue.")
        print(f"     In production (browser → same LAN server) expect <30ms.")
    results.append(ok)
else:
    print("  Skipped (no webcam)")


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "═" * 55)
passed = sum(results)
total  = len(results)
if passed == total:
    print(f"  {PASS} All {total} tests passed — endpoint is ready for the frontend team")
else:
    print(f"  {FAIL} {passed}/{total} passed — fix the failures above before handing off")
print("═" * 55 + "\n")

sys.exit(0 if passed == total else 1)