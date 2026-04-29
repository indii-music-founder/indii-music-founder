import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import WaveMesh from './WaveMesh';

/**
 * CanvasRenderer — Lazy-loaded Canvas wrapper for Three.js rendering
 *
 * This component is dynamically imported to break the circular dependency:
 *   vendor-three → vendor-react (via zustand → use-sync-external-store)
 *
 * By deferring the Canvas import until this component actually renders,
 * we prevent vendor-three from being evaluated during app bootstrap.
 */
export default function CanvasRenderer() {
    return (
        <Canvas
            gl={{ antialias: false, alpha: true }}
            camera={{ position: [0, 2, 0], fov: 75 }}
            style={{ pointerEvents: 'none' }}
        >
            <Suspense fallback={null}>
                <WaveMesh />
            </Suspense>
        </Canvas>
    );
}
