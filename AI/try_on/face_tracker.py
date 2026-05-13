"""
Phase 3 — Face Tracker (updated for Phase 5 improvements)
Uses MediaPipe FaceLandmarker (Tasks API) to detect face landmarks in real time.

Updated landmarks for improved glasses placement:
  - Eye centers (inner + outer midpoints)
  - Nose bridge MID (168) — better vertical anchor than top (6)
  - Face edges (234, 454) — temple anchor points, encode head rotation
"""

import os
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions, RunningMode


# ── Landmark indices ──────────────────────────────────────────────────────────
LEFT_EYE_INNER    = 133
LEFT_EYE_OUTER    = 33
RIGHT_EYE_INNER   = 362
RIGHT_EYE_OUTER   = 263
NOSE_BRIDGE_TOP   = 6      # very top of nose bridge
NOSE_BRIDGE_MID   = 168    # middle of nose bridge — better anchor for glasses
LEFT_FACE_EDGE    = 234    # leftmost face point — left cheekbone (2D frame width)
RIGHT_FACE_EDGE   = 454    # rightmost face point — right cheekbone (2D frame width)

LEFT_ARM_HINGE    = 162    # left temple — arm hinge point
LEFT_EAR_TIP      = 93     # left tragus — arm hooks here behind ear
RIGHT_ARM_HINGE   = 389    # right temple — arm hinge point
RIGHT_EAR_TIP     = 323    # right tragus — arm hooks here behind ear
# ─────────────────────────────────────────────────────────────────────────────

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
        """Run face detection on a single BGR frame."""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        return self.landmarker.detect(mp_image)

    def get_landmarks(self, results, frame_width, frame_height):
        """
        Extract landmarks needed for glasses placement.

        Returns:
          left_eye        → center of left eye (inner+outer midpoint)
          right_eye       → center of right eye
          nose_bridge     → mid nose bridge — glasses vertical anchor
          left_face_edge  → leftmost face point — left temple anchor
          right_face_edge → rightmost face point — right temple anchor

        The face_edge points are critical: they encode head rotation naturally.
        When the face turns left, the right face_edge moves closer to the eyes
        and the left face_edge moves further — exactly what we need for
        perspective-correct glasses rendering.
        """
        if not results or not results.face_landmarks:
            return None

        lm = results.face_landmarks[0]

        def to_pixel(idx):
            return (
                int(lm[idx].x * frame_width),
                int(lm[idx].y * frame_height),
            )

        def midpoint(a, b):
            return ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)

        left_eye  = midpoint(to_pixel(LEFT_EYE_INNER),  to_pixel(LEFT_EYE_OUTER))
        right_eye = midpoint(to_pixel(RIGHT_EYE_INNER), to_pixel(RIGHT_EYE_OUTER))

        return {
            "left_eye":        left_eye,
            "right_eye":       right_eye,
            "nose_bridge":     to_pixel(NOSE_BRIDGE_MID),   # 168 — better than 6
            "left_face_edge":  to_pixel(LEFT_FACE_EDGE),
            "right_face_edge": to_pixel(RIGHT_FACE_EDGE),
            # ── Glasses arm anchors ───────────────────────────────────────────
            # Two points per side so the frontend knows where the arm starts
            # (hinge, at the temple) and where it ends (ear_tip, at the tragus).
            "left_arm_hinge":  to_pixel(LEFT_ARM_HINGE),    # 162
            "left_ear_tip":    to_pixel(LEFT_EAR_TIP),      # 93
            "right_arm_hinge": to_pixel(RIGHT_ARM_HINGE),   # 389
            "right_ear_tip":   to_pixel(RIGHT_EAR_TIP),     # 323
        }

    def draw_mesh(self, frame, results):
        """Draw all face landmark dots for visual debugging."""
        if results and results.face_landmarks:
            h, w = frame.shape[:2]
            for lm_list in results.face_landmarks:
                for lm in lm_list:
                    x, y = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)
        return frame

    def draw_key_points(self, frame, landmarks):
        """
        Draw our key points as colored circles.
        Color coding:
          Cyan    = eye centers       (lens anchors)
          Magenta = nose bridge       (vertical anchor)
          Yellow  = face edges        (temple anchors)
        """
        if not landmarks:
            return frame

        colors = {
            "left_eye":        (255, 255, 0),    # Cyan
            "right_eye":       (255, 255, 0),    # Cyan
            "nose_bridge":     (255, 0, 255),    # Magenta
            "left_face_edge":  (0,   255, 255),  # Yellow
            "right_face_edge": (0,   255, 255),  # Yellow
            # Arm anchors — Orange so they stand out from the existing points
            "left_arm_hinge":  (0,   165, 255),  # Orange
            "left_ear_tip":    (0,   100, 255),  # Dark orange
            "right_arm_hinge": (0,   165, 255),  # Orange
            "right_ear_tip":   (0,   100, 255),  # Dark orange
        }

        for name, point in landmarks.items():
            cv2.circle(frame, point, 6, colors[name], -1)
            cv2.circle(frame, point, 6, (0, 0, 0), 1)
            cv2.putText(frame, name.replace("_", " "),
                        (point[0] + 8, point[1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.32, (255, 255, 255), 1)

        # Eye line
        cv2.line(frame, landmarks["left_eye"], landmarks["right_eye"], (255, 255, 0), 2)
        # Temple line (cheekbone width — used for 2D frame sizing)
        cv2.line(frame, landmarks["left_face_edge"], landmarks["right_face_edge"],
                 (0, 255, 255), 1)
        # Arm lines — hinge → ear tip, one per side
        cv2.line(frame, landmarks["left_arm_hinge"],  landmarks["left_ear_tip"],
                 (0, 165, 255), 2)
        cv2.line(frame, landmarks["right_arm_hinge"], landmarks["right_ear_tip"],
                 (0, 165, 255), 2)

        return frame

    def close(self):
        """Release MediaPipe resources."""
        self.landmarker.close()