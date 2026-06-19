'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Quaternion, Vector3 } from 'three';
import {
  computeGlassesTransform,
} from '@/lib/landmarkUtils';

const FLASK_BASE        = 'http://localhost:5001';
const FRAME_INTERVAL_MS = 66;
const CAPTURE_QUALITY   = 0.7;

// ─── GlassesModel ─────────────────────────────────────────────────────────────
//
// GLB structure (Blender export):
//   Node "Nose bone"      → mesh "model"       (front frame, 13,565 verts)
//   Node "Left Ear bone"  → mesh "model.001"   (left arm  — folded closed)
//   Node "Right Ear bone" → mesh "model.002"   (right arm — folded closed)
//   All nodes: 90° X-axis rotation baked in
//
// Strategy: clone ONLY the "Nose bone" node and render it.
// The arm nodes are never cloned or added to the scene, so they cannot appear.

function GlassesModel({ url, landmarkRef }) {
  const { scene } = useGLTF(url);

  // ── Refs for the three independent groups ─────────────────────────────────
  const noseRef  = useRef();   // front frame
  const leftRef  = useRef();   // left arm
  const rightRef = useRef();   // right arm

  // ── frameData holds one-time measurements computed in useEffect ───────────
  // naturalScale   : 1 / frontFrameWidth  — scales nose mesh so its X width = 1 world unit
  // centerOffset   : bounding-box center of the nose mesh (to center it on the anchor)
  // leftArmLength  : natural length of the left arm mesh (longest axis, world units)
  // rightArmLength : natural length of the right arm mesh (longest axis, world units)
  // leftArmOffset  : bounding-box center of the left arm mesh (to pivot from hinge end)
  // rightArmOffset : bounding-box center of the right arm mesh
  const frameData = useRef(null);
  const _armDir   = useRef(new Vector3());
  const _armQuat  = useRef(new Quaternion());

  // ── Clones stored in state so React re-renders when they are ready ─────────
  const [clones, setClones] = useState(null);   // { nose, left, right }

  /** Measure arm mesh: natural length, local length axis, scale axis letter. */
  function measureArm(clone) {
    const bb = new Box3().setFromObject(clone);
    const sz = new Vector3(); bb.getSize(sz);
    const c  = new Vector3(); bb.getCenter(c);
    const length = Math.max(sz.x, sz.y, sz.z, 0.001);
    const scaleAxis =
      sz.x >= sz.y && sz.x >= sz.z ? 'x' :
      sz.y >= sz.x && sz.y >= sz.z ? 'y' : 'z';
    // Bone origin ≈ hinge; bbox center points from hinge toward arm tip (folded inward in GLB).
    const localAxis = c.length() > 1e-4
      ? c.clone().normalize()
      : new Vector3(
          scaleAxis === 'x' ? 1 : 0,
          scaleAxis === 'y' ? 1 : 0,
          scaleAxis === 'z' ? 1 : 0,
        );
    return { length, localAxis, scaleAxis, center: c };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // useEffect — runs ONCE per GLB load
  // PURPOSE:
  //   1. Find the three bone nodes by name in the loaded scene
  //   2. Clone each one independently (so transforms don't interfere)
  //   3. Measure bounding boxes:
  //        • nose  → naturalScale + centerOffset  (for front-frame placement)
  //        • left  → leftArmLength  + leftArmOffset  (for arm scaling/pivoting)
  //        • right → rightArmLength + rightArmOffset
  //   4. Log the pivot center of each arm — if it prints near (0,0,0) the
  //      pivot is at the hinge end (good). If not, the armOffset corrects it.
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    frameData.current = null;
    setClones(null);

    // ── 1. Find nodes ────────────────────────────────────────────────────────
    console.log('[GlassesModel] scene nodes:');
    scene.traverse((obj) =>
      console.log('  type=' + obj.type + ' name=>>>' + obj.name + '<<< isMesh=' + obj.isMesh)
    );

    let noseNode = null, leftNode = null, rightNode = null;
    scene.traverse((obj) => {
      const n = obj.name.trim().toLowerCase();
      if (!noseNode  && n === 'nose bone')      noseNode  = obj;
      if (!leftNode  && n === 'left ear bone')  leftNode  = obj;
      if (!rightNode && n === 'right ear bone') rightNode = obj;
    });

    if (!noseNode) {
      console.warn('[GlassesModel] "Nose bone" not found — falling back to full scene');
      noseNode = scene;
    }
    if (!leftNode || !rightNode) {
      console.warn('[GlassesModel] Arm nodes not found — arms will not render');
    }

    // ── 2. Clone each node independently ─────────────────────────────────────
    const noseClone  = noseNode.clone(true);
    const leftClone  = leftNode  ? leftNode.clone(true)  : null;
    const rightClone = rightNode ? rightNode.clone(true) : null;

    // ── 3. Measure nose bounding box ─────────────────────────────────────────
    const noseBB = new Box3().setFromObject(noseClone);
    const noseSz = new Vector3(); noseBB.getSize(noseSz);
    const noseC  = new Vector3(); noseBB.getCenter(noseC);
    const fw     = Math.max(noseSz.x, 0.001);
    console.log('[GlassesModel] nose fw=' + fw.toFixed(3)
      + ' center=(' + noseC.x.toFixed(3) + ',' + noseC.y.toFixed(3) + ')');

    // ── 3b. Measure arm bounding boxes ───────────────────────────────────────
    // leftArmLength / rightArmLength: natural length of each arm mesh (longest bounding-box axis).
    //   Used in useFrame to compute scale = desiredWorldLength / naturalLength.
    //
    // leftArmOffset / rightArmOffset: bounding-box center of the arm in its
    //   LOCAL space. If the Blender pivot is at the hinge end the center will
    //   be ~half the arm length away from origin. We subtract this offset so
    //   the hinge end of the arm sits exactly at the hinge landmark position.
    //
    // 👇 THIS IS WHERE "Left arm center" IS LOGGED:
    //   • Near (0, 0, 0) → pivot IS at the hinge end (ideal, no extra offset needed)
    //   • e.g. (0.4, 0, 0) → pivot is at the arm midpoint; offset will correct it
    let leftArmLength = 1, leftArmAxis = new Vector3(0, 0, 1), leftArmScaleAxis = 'z';
    let rightArmLength = 1, rightArmAxis = new Vector3(0, 0, 1), rightArmScaleAxis = 'z';

    if (leftClone) {
      const m = measureArm(leftClone);
      leftArmLength = m.length;
      leftArmAxis = m.localAxis;
      leftArmScaleAxis = m.scaleAxis;
      console.log('[GlassesModel] Left arm center:', m.center.x.toFixed(3), m.center.y.toFixed(3), m.center.z.toFixed(3),
        '| natural length (max axis):', leftArmLength.toFixed(3),
        '| local axis:', leftArmAxis.x.toFixed(3), leftArmAxis.y.toFixed(3), leftArmAxis.z.toFixed(3),
        '| scale axis:', leftArmScaleAxis);
    }
    if (rightClone) {
      const m = measureArm(rightClone);
      rightArmLength = m.length;
      rightArmAxis = m.localAxis;
      rightArmScaleAxis = m.scaleAxis;
      console.log('[GlassesModel] Right arm center:', m.center.x.toFixed(3), m.center.y.toFixed(3), m.center.z.toFixed(3),
        '| natural length (max axis):', rightArmLength.toFixed(3),
        '| local axis:', rightArmAxis.x.toFixed(3), rightArmAxis.y.toFixed(3), rightArmAxis.z.toFixed(3),
        '| scale axis:', rightArmScaleAxis);
    }

    // ── 4. Store all measurements ─────────────────────────────────────────────
    frameData.current = {
      naturalScale:   1 / fw,
      centerOffset:   { x: noseC.x, y: noseC.y },
      leftArmLength,  leftArmAxis,  leftArmScaleAxis,
      rightArmLength, rightArmAxis, rightArmScaleAxis,
    };

    setClones({ nose: noseClone, left: leftClone, right: rightClone });

    // Cleanup: dispose geometry + materials when GLB changes
    return () => {
      [noseClone, leftClone, rightClone].forEach((c) => {
        if (!c) return;
        c.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        });
      });
      frameData.current = null;
    };
  }, [scene]);

  // ════════════════════════════════════════════════════════════════════════════
  // useFrame — runs EVERY FRAME (60 fps)
  // PURPOSE:
  //   Apply the latest landmark transform to each of the three mesh groups.
  //
  // Front frame (noseRef):
  //   • Positioned at the eye-midpoint anchor (world space)
  //   • Scaled so its X-width matches the hinge-to-hinge pixel distance
  //   • Rotated for head tilt (rotationZ) and head turn (rotationY)
  //
  // Arms (leftRef / rightRef):
  //   • Positioned at their respective hinge landmark (world space)
  //   • Rotated so they point from hinge → ear tip (Math.atan2 of that vector)
  //   • Scaled independently so their length matches the pixel hinge→ear distance
  //
  // 👇 THIS IS WHERE armWorldLength SCALING IS APPLIED (inside the arm blocks):
  //   armScale = desiredWorldLength / naturalArmLength
  //   ref.scale.set(finalFrameScale, finalFrameScale, armScale)
  //   Z is stretched to match hinge→ear distance (arm length runs along Z after
  //   the 90° baked X-rotation); X/Y use the front-frame scale for thickness.
  // ════════════════════════════════════════════════════════════════════════════
  useFrame(() => {
    const fd = frameData.current;
    const lm = landmarkRef.current;
    const allHidden = !fd || !lm || !isFinite(lm.position?.x) || !isFinite(lm.scale);

    // Hide everything if no face detected
    [noseRef, leftRef, rightRef].forEach((r) => {
      if (r.current) r.current.visible = !allHidden;
    });
    if (allHidden) return;

    const { position, scale, rotationZ, rotationY,
            leftHinge, leftEar, rightHinge, rightEar } = lm;

    const finalFrameScale = fd.naturalScale * scale;

    // ── Front frame ───────────────────────────────────────────────────────────
    if (noseRef.current) {
      noseRef.current.visible = true;
      noseRef.current.position.set(
        position.x - fd.centerOffset.x * finalFrameScale,
        position.y - fd.centerOffset.y * finalFrameScale,
        0.05,
      );
      noseRef.current.scale.setScalar(finalFrameScale);
      noseRef.current.rotation.set(0, rotationY ?? 0, rotationZ ?? 0);
    }

    // ── Left arm ──────────────────────────────────────────────────────────────
    if (leftRef.current && leftHinge && leftEar) {
      const ldx = leftEar.x - leftHinge.x;
      const ldy = leftEar.y - leftHinge.y;
      const leftArmWorldLength = Math.sqrt(ldx * ldx + ldy * ldy);
      const leftArmScale = leftArmWorldLength / fd.leftArmLength;

      _armDir.current.set(ldx, ldy, 0).normalize();
      _armQuat.current.setFromUnitVectors(fd.leftArmAxis, _armDir.current);

      leftRef.current.visible = true;
      leftRef.current.position.set(leftHinge.x, leftHinge.y, 0.05);
      leftRef.current.quaternion.copy(_armQuat.current);
      leftRef.current.scale.set(
        fd.leftArmScaleAxis === 'x' ? finalFrameScale * leftArmScale : finalFrameScale,
        fd.leftArmScaleAxis === 'y' ? finalFrameScale * leftArmScale : finalFrameScale,
        fd.leftArmScaleAxis === 'z' ? finalFrameScale * leftArmScale : finalFrameScale,
      );
    }

    // ── Right arm ─────────────────────────────────────────────────────────────
    if (rightRef.current && rightHinge && rightEar) {
      const rdx = rightEar.x - rightHinge.x;
      const rdy = rightEar.y - rightHinge.y;
      const rightArmWorldLength = Math.sqrt(rdx * rdx + rdy * rdy);
      const rightArmScale = rightArmWorldLength / fd.rightArmLength;

      _armDir.current.set(rdx, rdy, 0).normalize();
      _armQuat.current.setFromUnitVectors(fd.rightArmAxis, _armDir.current);

      rightRef.current.visible = true;
      rightRef.current.position.set(rightHinge.x, rightHinge.y, 0.05);
      rightRef.current.quaternion.copy(_armQuat.current);
      rightRef.current.scale.set(
        fd.rightArmScaleAxis === 'x' ? finalFrameScale * rightArmScale : finalFrameScale,
        fd.rightArmScaleAxis === 'y' ? finalFrameScale * rightArmScale : finalFrameScale,
        fd.rightArmScaleAxis === 'z' ? finalFrameScale * rightArmScale : finalFrameScale,
      );
    }
  });

  return (
    <>
      {/* Front frame — Nose bone mesh */}
      <group ref={noseRef}>
        {clones?.nose && <primitive object={clones.nose} />}
      </group>

      {/* Left arm — Left Ear bone mesh */}
      <group ref={leftRef}>
        {clones?.left && <primitive object={clones.left} />}
      </group>

      {/* Right arm — Right Ear bone mesh */}
      <group ref={rightRef}>
        {clones?.right && <primitive object={clones.right} />}
      </group>
    </>
  );
}

// ─── ContextLostHandler ───────────────────────────────────────────────────────

function ContextLostHandler() {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost     = () => console.warn('[TryOnCamera] WebGL context lost');
    const onRestored = () => console.info('[TryOnCamera] WebGL context restored');
    canvas.addEventListener('webglcontextlost',     onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost',     onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl]);
  return null;
}

// ─── TryOnCamera ─────────────────────────────────────────────────────────────

export default function TryOnCamera({ glbModel, onClose }) {
  const videoRef       = useRef(null);
  const captureCanvas  = useRef(null);
  const threeCanvasRef = useRef(null);
  const intervalRef    = useRef(null);
  const landmarkRef    = useRef(null);
  const isSending      = useRef(false);

  const [aiStatus,  setAiStatus]  = useState('checking');
  const [camStatus, setCamStatus] = useState('starting');
  const [detected,  setDetected]  = useState(false);
  const [fps,       setFps]       = useState(0);

  const endpoint = `${FLASK_BASE}/try-on/glasses/landmarks`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${FLASK_BASE}/health`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setAiStatus(d.status === 'ok' ? 'ready' : 'error'); })
      .catch(() => { if (!cancelled) setAiStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (aiStatus !== 'ready') return;
    let stream = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          return videoRef.current.play();
        }
      })
      .then(() => setCamStatus('active'))
      .catch(() => setCamStatus('error'));
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [aiStatus]);

  const sendFrame = useCallback(async () => {
    if (isSending.current) return;
    const video  = videoRef.current;
    const canvas = captureCanvas.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const frameB64    = canvas.toDataURL('image/jpeg', CAPTURE_QUALITY);
    const threeCanvas = threeCanvasRef.current;
    const screenW     = threeCanvas?.clientWidth  || window.innerWidth;
    const screenH     = threeCanvas?.clientHeight || window.innerHeight;

    isSending.current = true;
    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ frame: frameB64 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      setDetected(data.detected);
      if (data.fps) setFps(data.fps);

      if (data.detected) {
        if (data.landmarks) {
          landmarkRef.current = computeGlassesTransform(
            data.landmarks, data.frame_width, data.frame_height, screenW, screenH,
          );
        }
      }
    } catch (err) {
      console.warn('Flask request failed:', err.message);
    } finally {
      isSending.current = false;
    }
  }, [endpoint]);

  useEffect(() => {
    if (camStatus !== 'active') return;
    intervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [camStatus, sendFrame]);

  useEffect(() => {
    return () => { fetch(`${FLASK_BASE}/try-on/reset`, { method: 'POST' }).catch(() => {}); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm tracking-wide">Live Try-On</span>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            aiStatus === 'ready' ? 'bg-emerald-500/20 text-emerald-400' :
            aiStatus === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              aiStatus === 'ready' ? 'bg-emerald-400 animate-pulse' :
              aiStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
            }`} />
            {aiStatus === 'ready' ? 'AI Ready' : aiStatus === 'error' ? 'AI Offline' : 'Connecting...'}
          </span>
          {camStatus === 'active' && (
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              detected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${detected ? 'bg-blue-400 animate-pulse' : 'bg-white/30'}`} />
              {detected ? 'Face detected' : 'No detection'}
            </span>
          )}
          {fps > 0 && <span className="text-xs text-white/30 font-mono">{fps} fps</span>}
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {aiStatus === 'checking' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Connecting to AI service...</p>
          </div>
        )}
        {aiStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20">
            <p className="text-white font-medium text-sm">AI Service Unavailable</p>
            <p className="text-white/40 text-xs">Make sure the Flask server is running on port 5001</p>
            <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">Close</button>
          </div>
        )}
        {camStatus === 'error' && aiStatus === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20">
            <p className="text-white font-medium text-sm">Camera Access Denied</p>
            <p className="text-white/40 text-xs">Please allow camera access and try again</p>
            <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">Close</button>
          </div>
        )}
        {camStatus === 'starting' && aiStatus === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Starting camera...</p>
          </div>
        )}

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          playsInline muted autoPlay
        />
        <canvas ref={captureCanvas} className="hidden" />

        {glbModel && (
          <Canvas
            ref={threeCanvasRef}
            className="absolute inset-0"
            style={{ background: 'transparent' }}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
            camera={{ position: [0, 0, 5], fov: 50 }}
            dpr={[1, 1.5]}
          >
            <ContextLostHandler />
            <ambientLight intensity={1.2} />
            <directionalLight position={[0, 2, 3]} intensity={0.8} />
            <Suspense fallback={null}>
              <GlassesModel url={glbModel} landmarkRef={landmarkRef} />
            </Suspense>
          </Canvas>
        )}

        {camStatus === 'active' && !detected && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <div className="px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full border border-white/10">
              <p className="text-white/70 text-xs text-center">Point your face at the camera</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}