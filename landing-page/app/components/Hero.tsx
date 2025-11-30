'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls, Sphere } from '@react-three/drei';

function ParticleSphere() {
    const mesh = useRef<THREE.Points>(null!);

    const particles = useMemo(() => {
        const count = 5000;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const theta = THREE.MathUtils.randFloatSpread(360);
            const phi = THREE.MathUtils.randFloatSpread(360);

            const x = 2 * Math.sin(theta) * Math.cos(phi);
            const y = 2 * Math.sin(theta) * Math.sin(phi);
            const z = 2 * Math.cos(theta);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
        }

        return positions;
    }, []);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        mesh.current.rotation.y = time * 0.1;
        mesh.current.rotation.x = time * 0.05;
    });

    return (
        <points ref={mesh}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particles.length / 3}
                    array={particles}
                    itemSize={3}
                    args={[particles, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.02}
                color="#b026ff"
                sizeAttenuation={true}
                transparent={true}
                opacity={0.8}
            />
        </points>
    );
}

export default function Hero() {
    return (
        <section className="h-screen w-full relative bg-obsidian flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
                    <ambientLight intensity={0.5} />
                    <ParticleSphere />
                    <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
                </Canvas>
            </div>

            <div className="z-10 text-center pointer-events-none">
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-4">
                    indiiOS
                </h1>
                <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto font-light tracking-wide">
                    Your Label. Your Studio. Your Rules.
                </p>
                <p className="text-sm text-neon-purple mt-4 uppercase tracking-widest">
                    The Operating System for Independence
                </p>
            </div>
        </section>
    );
}
