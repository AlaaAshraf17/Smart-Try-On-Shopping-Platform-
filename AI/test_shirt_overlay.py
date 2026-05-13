"""
Phase 4 — Shirt Overlay Test (Improved)
Tests all 4 improvements: smoothing, perspective warp, edge feathering, sleeve fill.

Controls:
  q → quit
  s → save a snapshot
  + → increase shirt width
  - → decrease shirt width
  l → toggle landmarks on/off
  w → toggle warp on/off     (compare flat vs perspective)
  f → toggle feather on/off  (compare hard vs soft edges)
  v → toggle sleeve fill on/off
"""

import cv2
import time
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from try_on.body_tracker  import BodyTracker
from try_on.shirt_overlay import load_shirt, prepare_shirt, overlay_shirt
import try_on.shirt_overlay as shirt_mod

CAMERA_INDEX = 0
SHIRT_PATH   = os.path.join("assets", "shirts", "T-Shirt.png")
WINDOW_NAME  = "Smart Try-On | Phase 4 Improved"
SNAPSHOT_DIR = "snapshots"


def calculate_fps(prev_time):
    current_time = time.time()
    fps = 1 / (current_time - prev_time) if (current_time - prev_time) > 0 else 0
    return fps, current_time


def draw_status(frame, fps, detected, show_lm, show_warp, show_feather, show_sleeve):
    h, w = frame.shape[:2]

    cv2.putText(frame, f"FPS: {int(fps)}", (15, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)

    status = "Body: DETECTED" if detected else "Body: looking..."
    color  = (0, 255, 0) if detected else (0, 100, 255)
    cv2.putText(frame, status, (15, 68),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA)

    cv2.putText(frame, f"Width: {shirt_mod.SHIRT_WIDTH_SCALE:.2f}  (+/- adjust)",
                (15, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

    # Toggle states top-right
    toggles = [
        (f"[L] Landmarks:   {'ON' if show_lm      else 'OFF'}", show_lm),
        (f"[W] Perspective: {'ON' if show_warp    else 'OFF'}", show_warp),
        (f"[F] Feathering:  {'ON' if show_feather else 'OFF'}", show_feather),
        (f"[V] Sleeve fill: {'ON' if show_sleeve  else 'OFF'}", show_sleeve),
    ]
    for i, (label, state) in enumerate(toggles):
        color = (0, 255, 0) if state else (100, 100, 100)
        cv2.putText(frame, label, (w - 250, 28 + i * 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, color, 1)

    cv2.putText(frame, "Q:quit  S:snap  +/-:width  L/W/F/V:toggles",
                (15, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (180, 180, 180), 1)
    return frame


def save_snapshot(frame):
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    filename = os.path.join(SNAPSHOT_DIR, f"snapshot_{int(time.time())}.png")
    cv2.imwrite(filename, frame)
    print(f"[✓] Snapshot saved: {filename}")


def main():
    print("─" * 50)
    print("  Smart Try-On | Phase 4 — Improved Shirt Overlay")
    print("─" * 50)

    # Load shirt — once at startup
    print(f"  Loading shirt: {SHIRT_PATH}")
    try:
        shirt          = load_shirt(SHIRT_PATH)
        shirt_feathered = prepare_shirt(shirt)   # pre-feather once, reuse every frame
        print(f"  Shirt loaded & feathered. Size: {shirt.shape[1]}x{shirt.shape[0]}px")
    except FileNotFoundError as e:
        print(f"\n[✗] {e}"); return

    print("  Loading MediaPipe Pose model...")
    try:
        body_tracker = BodyTracker()
    except FileNotFoundError as e:
        print(f"\n[✗] {e}"); return
    print("  Model loaded!")

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("\n[✗] ERROR: Could not open camera.")
        body_tracker.close(); return

    ret, frame = cap.read()
    if not ret:
        print("\n[✗] ERROR: Could not read from camera.")
        cap.release(); body_tracker.close(); return

    h, w = frame.shape[:2]
    print(f"  Resolution : {w} x {h}")
    print(f"  Controls   : Q=quit | S=snap | +/-=width | L/W/F/V=toggles")
    print("─" * 50)

    show_lm      = False
    show_warp    = True    # perspective warp ON by default
    show_feather = True    # feathering ON by default
    show_sleeve  = True    # sleeve fill ON by default
    prev_time     = time.time()
    snapshot_flash = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[✗] Lost camera feed."); break

        frame = cv2.flip(frame, 1)

        # Detect
        try:
            body_results = body_tracker.detect(frame)
        except Exception as e:
            print(f"[!] Detection error: {e}"); body_results = None

        body_lm = body_tracker.get_landmarks(body_results, w, h) if body_results else None

        # Choose which shirt version to use based on toggles
        active_shirt = shirt_feathered if show_feather else shirt

        # Overlay shirt
        if show_warp:
            # Full improved pipeline
            frame = overlay_shirt(frame, body_lm, shirt, active_shirt)
        else:
            # Fallback: old flat resize+rotate method for comparison
            from try_on.shirt_overlay import _smoother
            smooth_lm = _smoother.smooth(body_lm)
            if smooth_lm and body_lm:
                import numpy as np
                ls = smooth_lm["left_shoulder"]
                rs = smooth_lm["right_shoulder"]
                lh = smooth_lm["left_hip"]
                rh = smooth_lm["right_hip"]
                shoulder_dist = np.sqrt((rs[0]-ls[0])**2 + (rs[1]-ls[1])**2)
                sw = int(shoulder_dist * shirt_mod.SHIRT_WIDTH_SCALE)
                img_h, img_w = active_shirt.shape[:2]
                sh = max(int(sw * img_h / img_w),
                         int(abs((lh[1]+rh[1])/2 - (ls[1]+rs[1])/2) * shirt_mod.SHIRT_HEIGHT_SCALE))
                resized = cv2.resize(active_shirt, (max(sw,10), max(sh,10)))
                cx = int((ls[0]+rs[0])/2)
                ty = int((ls[1]+rs[1])/2 - sh * shirt_mod.SHIRT_VERTICAL_OFFSET_RATIO)
                x1, y1 = cx - sw//2, ty
                x2, y2 = x1+sw, y1+sh
                fx1,fy1 = max(x1,0), max(y1,0)
                fx2,fy2 = min(x2,w), min(y2,h)
                if fx1<fx2 and fy1<fy2:
                    sx1,sy1 = fx1-x1, fy1-y1
                    rc = resized[sy1:sy1+(fy2-fy1), sx1:sx1+(fx2-fx1)]
                    fc = frame[fy1:fy2, fx1:fx2]
                    a = (rc[:,:,3:]/255.0)
                    frame[fy1:fy2,fx1:fx2] = (rc[:,:,:3]*a + fc*(1-a)).astype('uint8')

        # Optional landmarks on top
        if show_lm:
            frame = body_tracker.draw_key_points(frame, body_lm)

        fps, prev_time = calculate_fps(prev_time)
        frame = draw_status(frame, fps, body_lm is not None,
                            show_lm, show_warp, show_feather, show_sleeve)

        if snapshot_flash > 0:
            cv2.rectangle(frame, (0,0), (w-1,h-1), (0,255,0), 8)
            snapshot_flash -= 1

        cv2.imshow(WINDOW_NAME, frame)

        key = cv2.waitKey(1) & 0xFF
        if   key == ord("q"): break
        elif key == ord("s"): save_snapshot(frame); snapshot_flash = 10
        elif key == ord("l"): show_lm      = not show_lm;      print(f"[L] Landmarks: {'ON' if show_lm else 'OFF'}")
        elif key == ord("w"): show_warp    = not show_warp;    print(f"[W] Perspective warp: {'ON' if show_warp else 'OFF'}")
        elif key == ord("f"): show_feather = not show_feather; print(f"[F] Feathering: {'ON' if show_feather else 'OFF'}")
        elif key == ord("v"): show_sleeve  = not show_sleeve;  print(f"[V] Sleeve fill: {'ON' if show_sleeve else 'OFF'}")
        elif key in (ord("+"), ord("=")):
            shirt_mod.SHIRT_WIDTH_SCALE = round(min(shirt_mod.SHIRT_WIDTH_SCALE + 0.05, 2.5), 2)
            print(f"[+] Width: {shirt_mod.SHIRT_WIDTH_SCALE}")
        elif key == ord("-"):
            shirt_mod.SHIRT_WIDTH_SCALE = round(max(shirt_mod.SHIRT_WIDTH_SCALE - 0.05, 0.5), 2)
            print(f"[-] Width: {shirt_mod.SHIRT_WIDTH_SCALE}")

    print("\n[✓] Quit. Cleaning up...")
    cap.release()
    cv2.destroyAllWindows()
    body_tracker.close()


if __name__ == "__main__":
    main()