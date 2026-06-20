'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage } from '@react-three/drei';
import { Suspense, useMemo, useState, useEffect } from 'react';

function Model({ url, onLoaded, color }) {
  const { scene } = useGLTF(url);

  const clonedScene = useMemo(() => {
    onLoaded?.();
    return scene.clone();
  }, [scene, onLoaded]);

  useEffect(() => {
    // سيب اللون الأصلي للموديل كما هو لحد ما اليوزر يختار لون
    if (!color) return;

    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            if (mat.color) {
              mat.color.set(color);
            }
          });
        } else {
          if (child.material.color) {
            child.material.color.set(color);
          }
        }
      }
    });
  }, [clonedScene, color]);

  return <primitive object={clonedScene} />;
}

export default function Model3D({ modelPath, className = '' }) {
  const [loaded, setLoaded] = useState(false);

  // مفيش لون افتراضي، اعرض الموديل بلونه الأصلي
  const [color, setColor] = useState(null);

  useEffect(() => {
    setLoaded(false);
  }, [modelPath]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-slate-800 dark:border-t-white animate-spin" />
          </div>

          <span className="text-[10px] tracking-widest uppercase text-slate-400 dark:text-slate-500">
            Loading model
          </span>
        </div>
      )}

      {/* Color Picker */}
      <div className="absolute top-3 right-3 z-20 bg-white dark:bg-slate-800 rounded-lg p-2 shadow-lg">
        <input
          type="color"
          value={color || '#ffffff'}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 cursor-pointer border-0"
        />
      </div>

      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Stage
            environment="studio"
            intensity={0.5}
            adjustCamera={1.2}
            shadows={false}
          >
            <Model
              key={modelPath}
              url={modelPath}
              color={color}
              onLoaded={() => setLoaded(true)}
            />
          </Stage>

          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={0.5}
            maxDistance={10}
            autoRotate={true}
            autoRotateSpeed={1}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}