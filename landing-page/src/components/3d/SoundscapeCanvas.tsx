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
                    <fog attach="fog" args={['#080808', 8, 30]} />
                    <ambientLight intensity={0.5} />
                </Suspense>
            </Canvas>
        </div>
    );
}
