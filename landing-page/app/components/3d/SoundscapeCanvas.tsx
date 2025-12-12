'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import WaveMesh from './WaveMesh';

export default function SoundscapeCanvas() {
    return (
        <div className="fixed inset-0 z-[-1] w-full h-full bg-void">
            <Canvas
                camera={{ position: [0, 5, 10], fov: 45 }}
                dpr={[1, 1.5]} // Optimize for performance
                gl={{ antialias: true }}
            >
                <Suspense fallback={null}>
                    <WaveMesh />
                    <fog attach="fog" args={['#030303', 5, 20]} />
                    <ambientLight intensity={0.5} />
                </Suspense>
            </Canvas>
            {/* Vignette Overlay for depth */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,3,3,0.8)_100%)]" />
        </div>
    );
}
