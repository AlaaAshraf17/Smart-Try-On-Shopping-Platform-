"""
Phase 5 — Glasses Overlay Test (Improved)
Tests perspective warp, face-edge anchoring, smoothing, and feathering.

Controls:
  q → quit
  s → save a snapshot
  + → increase glasses width
  - → decrease glasses width
  u → shift glasses UP
  d → shift glasses DOWN
  l → toggle landmarks on/off
"""

import cv2
import time
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from try_on.face_tracker    import FaceTracker
from try_on.glasses_overlay import load_glasses, prepare_glasses, overlay_glasses
import try_on.glasses_overlay as glasses_mod

CAMERA_INDEX  = 0
GLASSES_PATH  = os.path.join("assets", "glasses", "glass6.png")
WINDOW_NAME   = "Smart Try-On | Phase 5 — Glasses Overlay"
SNAPSHOT_DIR  = "snapshots"


def calculate_fps(prev_time):
    current_time = time.time()
    fps = 1 / (current_time - prev_time) if (current_time - prev_time) > 0 else 0
    return fps, current_time


def draw_status(frame, fps, detected, show_lm):
    h, w = frame.shape[:2]

    cv2.putText(frame, f"FPS: {int(fps)}", (15, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)

    status = "Face: DETECTED" if detected else "Face: looking..."
    color  = (0, 255, 0) if detected else (0, 100, 255)
    cv2.putText(frame, status, (15, 68),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA)

    cv2.putText(frame, f"Width: {glasses_mod.GLASSES_WIDTH_SCALE:.2f} (+/-)  "
                    f"Vert: {glasses_mod.GLASSES_VERT_OFFSET:.2f} (U/D)",
                (15, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200, 200, 200), 1)

    lm_color = (0, 255, 0) if show_lm else (100, 100, 100)
    cv2.putText(frame, f"[L] Landmarks: {'ON' if show_lm else 'OFF'}",
                (w - 230, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, lm_color, 1)

    cv2.putText(frame, "Q:quit  S:snap  +/-:width  U/D:vertical  L:landmarks",
                (15, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (180, 180, 180), 1)
    return frame


def save_snapshot(frame):
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    filename = os.path.join(SNAPSHOT_DIR, f"snapshot_{int(time.time())}.png")
    cv2.imwrite(filename, frame)
    print(f"[✓] Snapshot saved: {filename}")


def main():
    print("─" * 50)
    print("  Smart Try-On | Phase 5 — Glasses Overlay (Improved)")
    print("─" * 50)

    # Load glasses — once at startup
    print(f"  Loading glasses: {GLASSES_PATH}")
    try:
        glasses          = load_glasses(GLASSES_PATH)
        glasses_feathered = prepare_glasses(glasses)
        print(f"  Glasses loaded & feathered. Size: {glasses.shape[1]}x{glasses.shape[0]}px")
    except FileNotFoundError as e:
        print(f"\n[✗] {e}"); return

    # Load face tracker
    print("  Loading MediaPipe Face model...")
    try:
        face_tracker = FaceTracker()
    except FileNotFoundError as e:
        print(f"\n[✗] {e}"); return
    print("  Model loaded!")

    # Open camera
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("\n[✗] ERROR: Could not open camera.")
        face_tracker.close(); return

    ret, frame = cap.read()
    if not ret:
        print("\n[✗] ERROR: Could not read from camera.")
        cap.release(); face_tracker.close(); return

    h, w = frame.shape[:2]
    print(f"  Resolution : {w} x {h}")
    print(f"  Controls   : Q=quit | S=snap | +/-=width | U/D=vertical | L=landmarks")
    print("─" * 50)
    print("  Tip: press L to see landmarks — check that face_edge points")
    print("       (yellow) sit at the sides of your face for correct temple placement")
    print("─" * 50)

    show_lm        = False
    prev_time      = time.time()
    snapshot_flash = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[✗] Lost camera feed."); break

        frame = cv2.flip(frame, 1)

        # Detect
        try:
            face_results = face_tracker.detect(frame)
        except Exception as e:
            print(f"[!] Detection error: {e}"); face_results = None

        face_lm = face_tracker.get_landmarks(face_results, w, h) if face_results else None

        # Overlay glasses — pass both original and feathered
        frame = overlay_glasses(frame, face_lm, glasses, glasses_feathered)

        # Optional landmarks on top
        if show_lm:
            frame = face_tracker.draw_key_points(frame, face_lm)

        fps, prev_time = calculate_fps(prev_time)
        frame = draw_status(frame, fps, face_lm is not None, show_lm)

        if snapshot_flash > 0:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 255, 0), 8)
            snapshot_flash -= 1

        cv2.imshow(WINDOW_NAME, frame)

        key = cv2.waitKey(1) & 0xFF
        if   key == ord("q"): break
        elif key == ord("s"): save_snapshot(frame); snapshot_flash = 10
        elif key == ord("l"):
            show_lm = not show_lm
            print(f"[L] Landmarks: {'ON' if show_lm else 'OFF'}")
        elif key in (ord("+"), ord("=")):
            glasses_mod.GLASSES_WIDTH_SCALE = round(
                min(glasses_mod.GLASSES_WIDTH_SCALE + 0.05, 2.0), 2)
            print(f"[+] Width: {glasses_mod.GLASSES_WIDTH_SCALE}")
        elif key == ord("-"):
            glasses_mod.GLASSES_WIDTH_SCALE = round(
                max(glasses_mod.GLASSES_WIDTH_SCALE - 0.05, 0.3), 2)
            print(f"[-] Width: {glasses_mod.GLASSES_WIDTH_SCALE}")
        elif key == ord("u"):
            glasses_mod.GLASSES_VERT_OFFSET = round(
                max(glasses_mod.GLASSES_VERT_OFFSET - 0.1, -1.0), 1)
            print(f"[U] Vert offset: {glasses_mod.GLASSES_VERT_OFFSET}")
        elif key == ord("d"):
            glasses_mod.GLASSES_VERT_OFFSET = round(
                min(glasses_mod.GLASSES_VERT_OFFSET + 0.1, 1.0), 1)
            print(f"[D] Vert offset: {glasses_mod.GLASSES_VERT_OFFSET}")

    print("\n[✓] Quit. Cleaning up...")
    cap.release()
    cv2.destroyAllWindows()
    face_tracker.close()


if __name__ == "__main__":
    main()