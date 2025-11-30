'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Sphere, Wireframe } from '@react-three/drei';

function HolographicGlobe() {
    const mesh = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        mesh.current.rotation.y += 0.005;
    });

    return (
        <Sphere ref={mesh} args={[2, 32, 32]}>
            <meshBasicMaterial color="#00ff9d" wireframe transparent opacity={0.1} />
            {/* Pins of light */}
            <group>
                {[...Array(10)].map((_, i) => {
                    const phi = Math.acos(-1 + (2 * i) / 10);
                    const theta = Math.sqrt(10 * Math.PI) * phi;
                    const x = 2 * Math.cos(theta) * Math.sin(phi);
                    const y = 2 * Math.sin(theta) * Math.sin(phi);
                    const z = 2 * Math.cos(phi);
                    return (
                        <mesh key={i} position={[x, y, z]}>
                            <sphereGeometry args={[0.05, 16, 16]} />
                            <meshBasicMaterial color="#00ff9d" />
                        </mesh>
                    );
                })}
            </group>
        </Sphere>
    );
}

export default function Business() {
    return (
        <section className="h-screen w-full relative bg-obsidian flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-50">
                <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                    <HolographicGlobe />
                </Canvas>
            </div>

            <div className="z-10 grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-6xl px-6">
                {/* Marketing Card */}
                <div className="glass-panel p-8 rounded-2xl border border-white/10 hover:border-signal-green/50 transition-colors duration-500">
                    <h3 className="text-3xl font-bold text-white mb-2">Command Center</h3>
                    <p className="text-signal-green text-sm uppercase tracking-wider mb-6">Marketing & Reach</p>
                    <p className="text-white/70">
                        Real-time global stream tracking. Visualize your audience as living data points on a holographic interface.
                    </p>
                </div>

                {/* Legal Card */}
                <div className="glass-panel p-8 rounded-2xl border border-white/10 hover:border-neon-purple/50 transition-colors duration-500">
                    <h3 className="text-3xl font-bold text-white mb-2">The Shield</h3>
                    <p className="text-neon-purple text-sm uppercase tracking-wider mb-6">Legal & Rights</p>
                    <p className="text-white/70">
                        AI-powered contract scanning. Instantly turns red flags (bad terms) into green lights (negotiated rights).
                    </p>
                </div>
            </div>

            <div className="absolute bottom-10 w-full text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-white">
                    Scale your reach. <span className="text-white/50">Secure your rights.</span>
                </h2>
            </div>
        </section>
    );
}
