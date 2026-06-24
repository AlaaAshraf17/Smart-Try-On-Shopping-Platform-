

const CAMERA_Z   = 5;
const CAMERA_FOV = 50;  

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
    z:  lm.z * worldWidth ,  // z scaled to world units
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

  const anchor = {
    x: (le.x + re.x) / 2,
    y: (le.y + re.y) / 2,
    z: (le.z + re.z) / 2,
  };

  const position = landmarkToWorld(anchor, frameWidth, frameHeight, canvasWidth, canvasHeight);

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