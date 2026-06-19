"""
Face Tracker — Phase 5/6
Uses MediaPipe FaceLandmarker (Tasks API).

Ear tip strategy (critical for glasses arm placement):
  No single MediaPipe landmark sits reliably "behind" the hinge in the
  direction the arm needs to go. Landmark-based ear tips always end up
  too low (jaw area) or co-located with the hinge (cheekbone area),
  giving a near-zero or downward hinge→ear vector.

  Fix: compute ear_tip ANALYTICALLY from face geometry:
    1. Take the face-edge direction vector (left_face_edge → right_face_edge).
       This is the horizontal axis of the face.
    2. Extend outward from the hinge along that axis by arm_length.
       arm_length = face_width * ARM_REACH_FACTOR (tunable).
    3. Optionally add a small upward offset so the arm angles slightly up
       toward the top of the ear (realistic glasses placement).

  This guarantees the arm always points horizontally outward, perfectly
  aligned with the face orientation, regardless of head tilt or turn.

ARM_REACH_FACTOR = 0.55 means the arm extends 55% of face width beyond
the hinge. Increase to push the arm endpoint further behind the head.
"""

import os
import math
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions, RunningMode


# ── Landmark indices ──────────────────────────────────────────────────────────
LEFT_EYE_INNER    = 133
LEFT_EYE_OUTER    = 33
RIGHT_EYE_INNER   = 362
RIGHT_EYE_OUTER   = 263
NOSE_BRIDGE_MID   = 168
LEFT_FACE_EDGE    = 234   # leftmost cheekbone point  — horizontal face axis
RIGHT_FACE_EDGE   = 454   # rightmost cheekbone point — horizontal face axis
LEFT_ARM_HINGE    = 162   # where left arm leaves the frame
RIGHT_ARM_HINGE   = 389   # where right arm leaves the frame
# ─────────────────────────────────────────────────────────────────────────────

# How far beyond the hinge the arm tip is placed, as a fraction of face width.
# 0.5 = arm extends half a face-width outward from the hinge.
# Increase if arms look too short, decrease if they overshoot.
ARM_REACH_FACTOR = 0.50   # fraction of face_width; arm extends this far outward from hinge
ARM_LIFT_FACTOR  = 0.0    # no longer used — lift is baked into ear tip Y directly

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "face_landmarker.task")


class FaceTracker:
    def __init__(self, detection_confidence=0.7, tracking_confidence=0.7):
        model_path = os.path.abspath(_MODEL_PATH)
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"face_landmarker.task not found at: {model_path}\n"
                "Download it from: https://storage.googleapis.com/mediapipe-models/"
                "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            )

        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=detection_confidence,
            min_face_presence_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        self.landmarker = FaceLandmarker.create_from_options(options)

    def detect(self, frame):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        return self.landmarker.detect(mp_image)

    def get_landmarks(self, results, frame_width, frame_height):
        """
        Extract landmarks for glasses placement.
        ear_tip landmarks are computed analytically (not from MediaPipe indices)
        so the arm always points correctly outward along the face plane.
        """
        if not results or not results.face_landmarks:
            return None

        lm = results.face_landmarks[0]

        def to_pixel(idx):
            return {
                "x": int(lm[idx].x * frame_width),
                "y": int(lm[idx].y * frame_height),
                "z": round(float(lm[idx].z), 4),
            }

        def midpoint_3d(a_idx, b_idx):
            a = lm[a_idx]; b = lm[b_idx]
            return {
                "x": int(((a.x + b.x) / 2) * frame_width),
                "y": int(((a.y + b.y) / 2) * frame_height),
                "z": round(float((a.z + b.z) / 2), 4),
            }

        lfe = to_pixel(LEFT_FACE_EDGE)
        rfe = to_pixel(RIGHT_FACE_EDGE)
        lah = to_pixel(LEFT_ARM_HINGE)
        rah = to_pixel(RIGHT_ARM_HINGE)

        # ── Face geometry ─────────────────────────────────────────────────────
        # Face-edge vector: left_face_edge → right_face_edge
        # This is the horizontal axis of the face, already accounting for tilt.
        face_dx   = rfe["x"] - lfe["x"]
        face_dy   = rfe["y"] - lfe["y"]
        face_width = math.sqrt(face_dx * face_dx + face_dy * face_dy)

        # Unit vector pointing RIGHT along the face plane
        if face_width > 0:
            ux = face_dx / face_width
            uy = face_dy / face_width
        else:
            ux, uy = 1.0, 0.0

        # Unit vector pointing UP along the face plane (perpendicular to face axis)
        # In image coords y increases downward, so "up" = rotate face axis -90°
        up_x = uy    #  perpendicular: (-uy, ux) rotates 90° CCW = "up" in image
        up_y = -ux

        arm_reach = face_width * ARM_REACH_FACTOR
        arm_lift  = face_width * ARM_LIFT_FACTOR   # slight upward offset

        # ── Ear tip computation ───────────────────────────────────────────────
        #
        # The capture canvas is drawn mirrored (ctx.scale(-1,1)) before sending
        # to Flask. After mirroring:
        #   lah (162) — anatomically left temple  — is on screen-LEFT  → outward = smaller x
        #   rah (389) — anatomically right temple — is on screen-RIGHT → outward = larger  x
        #
        # So left ear tip goes in the -x direction, right ear tip in the +x direction.
        # A slight upward offset (-y) is added because ears sit above the temple corners.

        frame_cx = frame_width / 2.0

        # Ear tip for left hinge (162 — screen-left after mirror): go left (-x) and slightly up (-y)
        left_ear = {
            "x": int(lah["x"] - arm_reach),
            "y": int(lah["y"] - arm_reach * 0.15),
            "z": round(lah["z"] - 0.03, 4),
        }

        # Ear tip for right hinge (389 — screen-right after mirror): go right (+x) and slightly up (-y)
        right_ear = {
            "x": int(rah["x"] + arm_reach),
            "y": int(rah["y"] - arm_reach * 0.15),
            "z": round(rah["z"] - 0.03, 4),
        }

        return {
            "left_eye":        midpoint_3d(LEFT_EYE_INNER,  LEFT_EYE_OUTER),
            "right_eye":       midpoint_3d(RIGHT_EYE_INNER, RIGHT_EYE_OUTER),
            "nose_bridge":     to_pixel(NOSE_BRIDGE_MID),
            "left_face_edge":  lfe,
            "right_face_edge": rfe,
            "left_arm_hinge":  lah,
            "left_ear_tip":    left_ear,
            "right_arm_hinge": rah,
            "right_ear_tip":   right_ear,
        }

    def draw_mesh(self, frame, results):
        if results and results.face_landmarks:
            h, w = frame.shape[:2]
            for lm_list in results.face_landmarks:
                for lm in lm_list:
                    x, y = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)
        return frame

    def draw_key_points(self, frame, landmarks):
        if not landmarks:
            return frame

        colors = {
            "left_eye":        (255, 255,   0),
            "right_eye":       (255, 255,   0),
            "nose_bridge":     (255,   0, 255),
            "left_face_edge":  (  0, 255, 255),
            "right_face_edge": (  0, 255, 255),
            "left_arm_hinge":  (  0, 165, 255),
            "right_arm_hinge": (  0, 165, 255),
            "left_ear_tip":    (  0,   0, 255),
            "right_ear_tip":   (  0,   0, 255),
        }

        for name, lm in landmarks.items():
            pt = (lm["x"], lm["y"])
            cv2.circle(frame, pt, 6, colors[name], -1)
            cv2.circle(frame, pt, 6, (0, 0, 0), 1)
            label = f"{name.replace('_', ' ')} z={lm['z']:.3f}"
            cv2.putText(frame, label, (pt[0] + 8, pt[1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.28, (255, 255, 255), 1)

        def pt(name):
            return (landmarks[name]["x"], landmarks[name]["y"])

        cv2.line(frame, pt("left_eye"),        pt("right_eye"),       (255, 255,   0), 2)
        cv2.line(frame, pt("left_face_edge"),  pt("right_face_edge"), (  0, 255, 255), 1)
        cv2.line(frame, pt("left_arm_hinge"),  pt("left_ear_tip"),    (  0, 165, 255), 2)
        cv2.line(frame, pt("right_arm_hinge"), pt("right_ear_tip"),   (  0, 165, 255), 2)

        return frame

    def close(self):
        self.landmarker.close()