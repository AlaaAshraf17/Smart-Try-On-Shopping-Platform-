/**
 * landmarkUtils.js
 *
 * Converts Flask landmark pixel coordinates + Z depth into Three.js world-space.
 *
 * Coordinate systems
 * ──────────────────
 * Flask frame (what MediaPipe sees):
 *   - The capture canvas is drawn MIRRORED (ctx.scale(-1,1)) before sending to Flask
 *   - So Flask landmarks are already in "mirror space" — matching what the user sees
 *   - Origin top-left, x rightward, y downward
 *
 * Three.js world space (camera at z=5, fov=50):
 *   - Origin at scene center
 *   - x rightward, y UPWARD (opposite of image), z toward viewer
 *
 * Conversion:
 *   nx = x / frameWidth  - 0.5   → [-0.5, +0.5], 0 = center
 *   ny = y / frameHeight - 0.5   → [-0.5, +0.5], 0 = center
 *   worldX =  nx * worldWidth    (no negation — frame is already mirrored)
 *   worldY = -ny * worldHeight   (flip Y: image down → Three.js up)
 *
 * IMPORTANT: canvasWidth/canvasHeight passed here must be the THREE.JS CANVAS
 * dimensions (screen size), NOT the capture canvas dimensions.
 * The Three.js camera frustum is based on the screen aspect ratio.
 */

const CAMERA_Z   = 5;
const CAMERA_FOV = 50;  // degrees — must match the Canvas camera fov in TryOnCamera.jsx

/**
 * Compute the visible world width at z=0 for the given canvas aspect ratio.
 * This is the key function that maps pixel space to Three.js world space.
 */
function computeWorldWidth(canvasWidth, canvasHeight) {
  const fovRad        = (CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  return visibleHeight * (canvasWidth / canvasHeight);
}

/**
 * Convert a single {x, y, z} Flask landmark to Three.js world coords.
 *
 * @param {{ x, y, z }} lm
 * @param {number} frameWidth    - Flask frame width (what MediaPipe processed)
 * @param {number} frameHeight   - Flask frame height
 * @param {number} canvasWidth   - THREE.JS canvas width (screen pixels)
 * @param {number} canvasHeight  - THREE.JS canvas height (screen pixels)
 */
export function landmarkToWorld(lm, frameWidth, frameHeight, canvasWidth, canvasHeight) {
  const worldWidth  = computeWorldWidth(canvasWidth, canvasHeight);
  const worldHeight = worldWidth * (canvasHeight / canvasWidth);

  const nx =  lm.x / frameWidth  - 0.5;
  const ny =  lm.y / frameHeight - 0.5;

  return {
    x:  nx * worldWidth,    // no negation — capture canvas is already mirrored
    y: -ny * worldHeight,   // flip Y: image y-down → Three.js y-up
    z:  lm.z * worldWidth,  // z scaled to world units
  };
}

/**
 * Screen-space Euclidean distance between two landmarks → Three.js world units.
 * Uses x/y only (ignores z) — measures the 2D projected distance.
 *
 * @param {number} canvasWidth  - THREE.JS canvas width
 */
export function pixelDistanceToWorld(a, b, frameWidth, canvasWidth, canvasHeight) {
  const dx         = a.x - b.x;
  const dy         = a.y - b.y;
  const pixelDist  = Math.sqrt(dx * dx + dy * dy);
  const worldWidth = computeWorldWidth(canvasWidth, canvasHeight);
  return (pixelDist / frameWidth) * worldWidth;
}

/**
 * computeGlassesTransform
 *
 * Converts face landmarks into the transform needed to place a 3D glasses GLB
 * on the face in Three.js world space.
 *
 * Returns:
 *   position  { x, y }   — world-space anchor point (eye midpoint)
 *   scale     number      — world-space width from hinge to hinge
 *   rotationZ number      — Z rotation in radians (head tilt)
 *   rotationY number      — Y rotation in radians (head turn, from Z depth)
 *
 * Anchor point:
 *   The eye midpoint is used as the anchor. This places the glasses center
 *   (nose bridge of the frame) directly between the two eyes, which is the
 *   correct vertical position for glasses on a face.
 *   Blending in nose_bridge (landmark 168, middle of nose) was pulling the
 *   anchor too far down, causing the glasses to sit on the nose.
 *
 * Scale:
 *   We use arm_hinge to arm_hinge (landmarks 162→389) as the frame width.
 *   This is the distance between the two hinge points where the arms attach —
 *   exactly the width of the glasses front frame.
 *   face_edge (234→454) is the full cheekbone width — too wide, oversizes the model.
 *
 * rotationY (head turn):
 *   MediaPipe Z depth: face_edge Z values encode head rotation.
 *   When face turns right: left_face_edge.z decreases (goes back), right increases.
 *   zDiff = lfe.z - rfe.z → positive = turned right → positive Y rotation.
 *   Scale factor 6.0: MediaPipe z range ~0.15 for 90° turn → 0.15 * 6 ≈ 0.9 rad ≈ 52°.
 *   Adjust if head turn looks too extreme or too subtle.
 */
export function computeGlassesTransform(
  landmarks,
  frameWidth,
  frameHeight,
  canvasWidth,
  canvasHeight,
) {
  const lfe = landmarks.left_face_edge;
  const rfe = landmarks.right_face_edge;
  const le  = landmarks.left_eye;
  const re  = landmarks.right_eye;
  const lah = landmarks.left_arm_hinge;
  const rah = landmarks.right_arm_hinge;

  // ── Anchor: eye midpoint only ─────────────────────────────────────────────
  // The glasses center (bridge of the frame) sits between the two eyes.
  // Using the eye midpoint directly places the frame correctly over the eyes.
  // nose_bridge (landmark 168) is the MIDDLE of the nose — blending it in
  // pulls the anchor too far down, which is why glasses appeared on the nose.
  const anchor = {
    x: (le.x + re.x) / 2,
    y: (le.y + re.y) / 2,
    z: (le.z + re.z) / 2,
  };

  const position = landmarkToWorld(anchor, frameWidth, frameHeight, canvasWidth, canvasHeight);

  // ── Scale: hinge-to-hinge distance = glasses frame width ──────────────────
  // arm_hinge landmarks (162/389) are where the arms attach to the frame.
  // This is the correct width for the front frame of the glasses.
  const scale = pixelDistanceToWorld(lah, rah, frameWidth, canvasWidth, canvasHeight);

  // ── rotationZ: head tilt from face-edge x/y angle ─────────────────────────
  const dx        = rfe.x - lfe.x;
  const dy        = rfe.y - lfe.y;
  const rotationZ = Math.atan2(-dy, dx);  // negate dy: image y-down → Three.js y-up

  // ── rotationY: head turn from Z depth difference ──────────────────────────
  const zDiff     = lfe.z - rfe.z;
  const rotationY = zDiff * 6.0;

  // ── Arm landmarks in world space ──────────────────────────────────────────
  const leftHinge  = landmarkToWorld(lah,                    frameWidth, frameHeight, canvasWidth, canvasHeight);
  const rightHinge = landmarkToWorld(rah,                    frameWidth, frameHeight, canvasWidth, canvasHeight);
  const leftEar    = landmarkToWorld(landmarks.left_ear_tip,  frameWidth, frameHeight, canvasWidth, canvasHeight);
  const rightEar   = landmarkToWorld(landmarks.right_ear_tip, frameWidth, frameHeight, canvasWidth, canvasHeight);

  return { position, scale, rotationZ, rotationY, leftHinge, leftEar, rightHinge, rightEar };
}