

import os
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode


# ── Landmark indices ──────────────────────────────────────────────────────────
NOSE            = 0
LEFT_EAR        = 7
RIGHT_EAR       = 8
LEFT_SHOULDER   = 11
RIGHT_SHOULDER  = 12
LEFT_ELBOW      = 13
RIGHT_ELBOW     = 14
LEFT_WRIST      = 15
RIGHT_WRIST     = 16
LEFT_HIP        = 23
RIGHT_HIP       = 24
# ─────────────────────────────────────────────────────────────────────────────

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "pose_landmarker.task")


class BodyTracker:
    def __init__(self, detection_confidence=0.7, tracking_confidence=0.7):
        model_path = os.path.abspath(_MODEL_PATH)
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"pose_landmarker.task not found at: {model_path}\n"
                "Download it from: https://storage.googleapis.com/mediapipe-models/"
                "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
            )

        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=detection_confidence,
            min_pose_presence_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence,
        )
        self.landmarker = PoseLandmarker.create_from_options(options)

    def detect(self, frame):
        """Run pose detection on a single BGR frame."""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        return self.landmarker.detect(mp_image)

    def get_landmarks(self, results, frame_width, frame_height):
        """
        Extract all landmarks needed for shirt placement AND sleeve fill.

        Returns a dict with keys:
          left_shoulder, right_shoulder,
          left_elbow,    right_elbow,      ← NEW: needed for sleeve fill
          left_wrist,    right_wrist,      ← NEW: needed for sleeve fill
          left_hip,      right_hip,
          nose

        Or None if no person is detected.
        """
        if not results or not results.pose_landmarks:
            return None

        lm = results.pose_landmarks[0]

        def to_pixel(idx):
            return (
                int(lm[idx].x * frame_width),
                int(lm[idx].y * frame_height),
            )

        return {
            "left_shoulder":  to_pixel(LEFT_SHOULDER),
            "right_shoulder": to_pixel(RIGHT_SHOULDER),
            "left_elbow":     to_pixel(LEFT_ELBOW),
            "right_elbow":    to_pixel(RIGHT_ELBOW),
            "left_wrist":     to_pixel(LEFT_WRIST),
            "right_wrist":    to_pixel(RIGHT_WRIST),
            "left_hip":       to_pixel(LEFT_HIP),
            "right_hip":      to_pixel(RIGHT_HIP),
            "left_ear":       to_pixel(LEFT_EAR),
            "right_ear":      to_pixel(RIGHT_EAR),
            "nose":           to_pixel(NOSE),
        }

    def draw_landmarks(self, frame, results):
        """Draw all detected pose landmarks as dots for visual debugging."""
        if results and results.pose_landmarks:
            h, w = frame.shape[:2]
            for lm_list in results.pose_landmarks:
                for lm in lm_list:
                    x, y = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (x, y), 3, (0, 255, 0), -1)
        return frame

    def draw_key_points(self, frame, landmarks):
        """
        Draw our key points as colored circles.
        Color coding:
          Green  = shoulders
          Orange = elbows
          Red    = wrists
          Blue   = hips
          Yellow = nose
        """
        if not landmarks:
            return frame

        colors = {
            "left_shoulder":  (0, 255, 0),
            "right_shoulder": (0, 255, 0),
            "left_elbow":     (0, 165, 255),
            "right_elbow":    (0, 165, 255),
            "left_wrist":     (0, 0, 255),
            "right_wrist":    (0, 0, 255),
            "left_hip":       (255, 0, 0),
            "right_hip":      (255, 0, 0),
            "left_ear":       (200, 200, 0),
            "right_ear":      (200, 200, 0),
            "nose":           (0, 255, 255),
        }

        for name, point in landmarks.items():
            cv2.circle(frame, point, 7, colors[name], -1)
            cv2.circle(frame, point, 7, (255, 255, 255), 2)
            cv2.putText(frame, name.replace("_", " "),
                        (point[0] + 8, point[1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

        # Shoulder line
        cv2.line(frame, landmarks["left_shoulder"],
                 landmarks["right_shoulder"], (0, 255, 0), 2)
        # Left arm line
        cv2.line(frame, landmarks["left_shoulder"],
                 landmarks["left_elbow"], (0, 165, 255), 1)
        cv2.line(frame, landmarks["left_elbow"],
                 landmarks["left_wrist"], (0, 165, 255), 1)
        # Right arm line
        cv2.line(frame, landmarks["right_shoulder"],
                 landmarks["right_elbow"], (0, 165, 255), 1)
        cv2.line(frame, landmarks["right_elbow"],
                 landmarks["right_wrist"], (0, 165, 255), 1)

        return frame

    def close(self):
        """Release MediaPipe resources."""
        self.landmarker.close()