

import cv2
import numpy as np
from try_on.Smoother import LandmarkSmoother


# ── Tuning constants ──────────────────────────────────────────────────────────
GLASSES_WIDTH_SCALE  = 1.0   # 1.0 = use exact face_edge-to-face_edge distance
                              # increase if glasses look too narrow
GLASSES_VERT_OFFSET  = 0.0   # vertical shift as fraction of glasses height
                              # 0.0 = centered on nose bridge
                              # positive = shift DOWN, negative = shift UP
FEATHER_RADIUS       = 3     # edge softness (smaller than shirt — glasses have hard frames)
SMOOTHER_BUFFER      = 2     # frames to average (reduced from 4 to minimize lag)
# ─────────────────────────────────────────────────────────────────────────────

_smoother = LandmarkSmoother(buffer_size=SMOOTHER_BUFFER)


def _pt(lm):
    """
    Extract a 2D [x, y] numpy array from a landmark value.

    Handles both formats produced by the pipeline:
      - Dict format:  {"x": 265, "y": 200, "z": -0.034}  ← face_tracker
      - Tuple format: (265, 200) or [265, 200]            ← legacy / tests
    """
    if isinstance(lm, dict):
        return np.array([lm["x"], lm["y"]], dtype=np.float32)
    return np.array(lm[:2], dtype=np.float32)


def load_glasses(path: str) -> np.ndarray:
    """
    Load a glasses PNG with transparency (BGRA — 4 channels).
    No flip needed — warp handles orientation.
    """
    glasses = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if glasses is None:
        raise FileNotFoundError(
            f"Could not load glasses image from: {path}\n"
            "Make sure the file exists and is a valid PNG."
        )
    if glasses.shape[2] == 3:
        alpha = np.ones((glasses.shape[0], glasses.shape[1], 1), dtype=glasses.dtype) * 255
        glasses = np.concatenate([glasses, alpha], axis=2)
    return glasses


def _get_opaque_bbox(glasses: np.ndarray, threshold: int = 30) -> tuple:
    """
    Find the bounding box of visible (opaque) pixels in the glasses image.
    Same approach as shirt — maps actual lens region not transparent padding.
    Returns (x_min, y_min, x_max, y_max).
    """
    alpha  = glasses[:, :, 3]
    opaque = alpha > threshold
    rows   = np.any(opaque, axis=1)
    cols   = np.any(opaque, axis=0)

    if not rows.any() or not cols.any():
        h, w = glasses.shape[:2]
        return 0, 0, w - 1, h - 1

    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    return int(x_min), int(y_min), int(x_max), int(y_max)


def _feather_edges(glasses: np.ndarray, radius: int) -> np.ndarray:
    """Soften glasses edges slightly. Smaller radius than shirt — frames are rigid."""
    if radius <= 0:
        return glasses
    glasses = glasses.copy()
    alpha   = glasses[:, :, 3]
    kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius, radius))
    eroded  = cv2.erode(alpha, kernel, iterations=1)
    blurred = cv2.GaussianBlur(eroded, (radius * 2 + 1, radius * 2 + 1), 0)
    glasses[:, :, 3] = blurred
    return glasses


def _compute_dst_points(landmarks: dict, glasses_img: np.ndarray) -> np.ndarray:
  
    le  = _pt(landmarks["left_eye"])
    re  = _pt(landmarks["right_eye"])
    nb  = _pt(landmarks["nose_bridge"])
    lfe = _pt(landmarks["left_face_edge"])
    rfe = _pt(landmarks["right_face_edge"])

    img_h, img_w = glasses_img.shape[:2]

    face_width_vec = rfe - lfe
    face_width     = np.linalg.norm(face_width_vec)
    face_dir       = face_width_vec / (face_width + 1e-6)

    glasses_half_w = face_width * GLASSES_WIDTH_SCALE / 2

    face_mid = (lfe + rfe) / 2
    anchor   = np.array([face_mid[0], nb[1]], dtype=np.float32)

    left_pt  = anchor - face_dir * glasses_half_w    # left temple on frame
    right_pt = anchor + face_dir * glasses_half_w    # right temple on frame

    x_min, y_min, x_max, y_max = _get_opaque_bbox(glasses_img)
    bbox_w  = max(x_max - x_min, 1)
    bbox_h  = max(y_max - y_min, 1)
    aspect  = bbox_h / bbox_w

    glasses_h = face_width * GLASSES_WIDTH_SCALE * aspect
    half_h    = glasses_h / 2

    perp_dir = np.array([-face_dir[1], face_dir[0]])   # perpendicular to face line
    center_y_offset = perp_dir * half_h * GLASSES_VERT_OFFSET

    # Top and bottom of the glasses frame
    top_center = anchor - perp_dir * half_h + center_y_offset
    bot_center = anchor + perp_dir * half_h + center_y_offset

    # Final 4 corners
    top_left  = top_center - face_dir * glasses_half_w
    top_right = top_center + face_dir * glasses_half_w
    bot_left  = bot_center - face_dir * glasses_half_w
    bot_right = bot_center + face_dir * glasses_half_w

    return np.array([top_left, top_right, bot_left, bot_right], dtype=np.float32)


def _warp_glasses(glasses: np.ndarray, landmarks: dict,
                  frame_w: int, frame_h: int) -> np.ndarray:
  
    x_min, y_min, x_max, y_max = _get_opaque_bbox(glasses)

    # Source: corners of the actual opaque glasses region
    src = np.array([
        [x_min, y_min],   # top-left
        [x_max, y_min],   # top-right
        [x_min, y_max],   # bot-left
        [x_max, y_max],   # bot-right
    ], dtype=np.float32)

    # Destination: where those corners land on the face
    dst = _compute_dst_points(landmarks, glasses)

    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(
        glasses, M, (frame_w, frame_h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)
    )
    return warped


def _blend_fullframe(frame: np.ndarray, warped: np.ndarray) -> np.ndarray:
    """Alpha-blend warped glasses onto frame."""
    g_bgr   = warped[:, :, :3].astype(np.float32)
    g_alpha = (warped[:, :, 3] / 255.0).astype(np.float32)
    f_bgr   = frame.astype(np.float32)
    a3      = np.stack([g_alpha] * 3, axis=2)
    return (g_bgr * a3 + f_bgr * (1.0 - a3)).astype(np.uint8)


def overlay_glasses(frame: np.ndarray, landmarks: dict,
                    glasses: np.ndarray,
                    glasses_feathered: np.ndarray) -> np.ndarray:
 
    if landmarks is None or glasses is None:
        return frame

    smooth_lm = _smoother.smooth(landmarks)
    if smooth_lm is None:
        return frame

    fr_h, fr_w = frame.shape[:2]
    warped = _warp_glasses(glasses_feathered, smooth_lm, fr_w, fr_h)
    frame  = _blend_fullframe(frame, warped)
    return frame


def prepare_glasses(glasses: np.ndarray) -> np.ndarray:

    return _feather_edges(glasses, radius=FEATHER_RADIUS)