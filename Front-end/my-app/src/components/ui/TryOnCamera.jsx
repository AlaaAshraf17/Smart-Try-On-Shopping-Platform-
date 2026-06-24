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



function GlassesModel({ url, landmarkRef }) {
  const { scene } = useGLTF(url);

  const frameGroupRef = useRef();

  const leftPivotRef  = useRef();
  const rightPivotRef = useRef();

  const leftArmRef  = useRef();
  const rightArmRef = useRef();

  const frameData = useRef(null);

  const _v3a = useRef(new Vector3());
  const _v3b = useRef(new Vector3());
  const _q   = useRef(new Quaternion());

  const [clones, setClones] = useState(null);

  function measureArm(clone) {
    const bb = new Box3().setFromObject(clone);
    const sz = new Vector3(); bb.getSize(sz);
    const c  = new Vector3(); bb.getCenter(c);
    const length = Math.max(sz.x, sz.y, sz.z, 0.001);
    const scaleAxis =
      sz.x >= sz.y && sz.x >= sz.z ? 'x' :
      sz.y >= sz.x && sz.y >= sz.z ? 'y' : 'z';
    const localAxis = c.length() > 1e-4
      ? c.clone().normalize()
      : new Vector3(
          scaleAxis === 'x' ? 1 : 0,
          scaleAxis === 'y' ? 1 : 0,
          scaleAxis === 'z' ? 1 : 0,
        );
    return { length, localAxis, scaleAxis, center: c };
  }
  useEffect(() => {
    frameData.current = null;
    setClones(null);

    let noseNode = null, leftNode = null, rightNode = null;

    scene.traverse((obj) => {
      const n = obj.name.trim().toLowerCase().replace(/_/g, ' ');
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

    const noseClone  = noseNode.clone(true);
    const leftClone  = leftNode  ? leftNode.clone(true)  : null;
    const rightClone = rightNode ? rightNode.clone(true) : null;

    if (noseClone)  noseClone.position.set(0, 0, 0);
    if (leftClone)  leftClone.position.set(0, 0, 0);
    if (rightClone) rightClone.position.set(0, 0, 0);

    const noseBB = new Box3().setFromObject(noseClone);
    const noseSz = new Vector3(); noseBB.getSize(noseSz);
    const noseC  = new Vector3(); noseBB.getCenter(noseC);
    const fw     = Math.max(noseSz.x, 0.001);

    console.log('[GlassesModel] nose fw=' + fw.toFixed(3)
      + ' center=(' + noseC.x.toFixed(3) + ',' + noseC.y.toFixed(3) + ')');

    // ── 3b. Measure arms ───────────────────────────────────────────────────
    let leftArmData  = { length: 1, localAxis: new Vector3(0, 0, 1), scaleAxis: 'z' };
    let rightArmData = { length: 1, localAxis: new Vector3(0, 0, 1), scaleAxis: 'z' };

    if (leftClone) {
      leftArmData = measureArm(leftClone);
      console.log('[GlassesModel] Left arm length:', leftArmData.length.toFixed(3),
        'axis:', leftArmData.localAxis.x.toFixed(3), leftArmData.localAxis.y.toFixed(3), leftArmData.localAxis.z.toFixed(3));
    }
    if (rightClone) {
      rightArmData = measureArm(rightClone);
      console.log('[GlassesModel] Right arm length:', rightArmData.length.toFixed(3),
        'axis:', rightArmData.localAxis.x.toFixed(3), rightArmData.localAxis.y.toFixed(3), rightArmData.localAxis.z.toFixed(3));
    }

    frameData.current = {
      naturalScale:   1 / fw,
      centerOffset:   { x: noseC.x, y: noseC.y },
      halfLocalWidth: fw / 2,     // in model's local units
      leftArm:        leftArmData,
      rightArm:       rightArmData,
    };

    setClones({ nose: noseClone, left: leftClone, right: rightClone });

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


  useFrame(() => {
    const fd = frameData.current;
    const lm = landmarkRef.current;
    const hidden = !fd || !lm || !isFinite(lm.position?.x) || !isFinite(lm.scale);

    if (frameGroupRef.current) frameGroupRef.current.visible = !hidden;
    if (hidden) return;

    const { position, scale, rotationZ, rotationY,
            leftHinge, leftEar, rightHinge, rightEar } = lm;

    const finalFrameScale = fd.naturalScale * scale;
    const tiltZ = rotationZ ?? 0;
    const turnY = (rotationY ?? 0) * -1.5;

    // ── 1. Frame group: world-space transform ────────────────────────────────
    const fg = frameGroupRef.current;
    if (!fg) return;

    const frameX = position.x - fd.centerOffset.x * finalFrameScale;
    const frameY = position.y - fd.centerOffset.y * finalFrameScale;
    const frameZ = 0.08;

    fg.position.set(frameX, frameY, frameZ);
    fg.rotation.set(0, turnY, tiltZ);
    fg.scale.setScalar(finalFrameScale);

    const inwardOffset = 0.18; 
    
    const verticalOffset = 0.1; 
    
    if (leftPivotRef.current) {
      leftPivotRef.current.position.set(-fd.halfLocalWidth + inwardOffset, verticalOffset, 0);
    }
    if (rightPivotRef.current) {
      rightPivotRef.current.position.set(fd.halfLocalWidth - inwardOffset, verticalOffset, 0);
    }
  
    const faceWidth = Math.abs(rightHinge.x - leftHinge.x);

    const orientArm = (pivotRef, armRef, earLandmark, armData) => {
      if (!pivotRef.current || !armRef.current || !earLandmark) return;

      const pivot = pivotRef.current;
      const arm   = armRef.current;

      pivot.getWorldPosition(_v3a.current);

      const estimatedZ = -faceWidth * 0.8; 
      
      const earDrop = 0.08; 
      
      _v3b.current.set(earLandmark.x, earLandmark.y - earDrop, estimatedZ);

      _v3b.current.sub(_v3a.current);
      const worldDist = _v3b.current.length();

      pivot.getWorldQuaternion(_q.current);
      _q.current.invert();
      _v3b.current.applyQuaternion(_q.current);

      const localDir = _v3b.current.clone().normalize();
      const armQuat = new Quaternion().setFromUnitVectors(armData.localAxis, localDir);
      arm.quaternion.copy(armQuat);

      const localDist = worldDist / finalFrameScale;
      const armScale = localDist / armData.length;

      arm.scale.set(
        armData.scaleAxis === 'x' ? armScale : 1,
        armData.scaleAxis === 'y' ? armScale : 1,
        armData.scaleAxis === 'z' ? armScale : 1,
      );
    };

    orientArm(leftPivotRef,  leftArmRef,  leftEar,  fd.leftArm);
    orientArm(rightPivotRef, rightArmRef, rightEar, fd.rightArm);
  });

  return (
    <group ref={frameGroupRef}>
      {clones?.nose && <primitive object={clones.nose} />}

      <group ref={leftPivotRef}>
        <group ref={leftArmRef}>
          {clones?.left && <primitive object={clones.left} />}
        </group>
      </group>

      <group ref={rightPivotRef}>
        <group ref={rightArmRef}>
          {clones?.right && <primitive object={clones.right} />}
        </group>
      </group>
    </group>
  );
}


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