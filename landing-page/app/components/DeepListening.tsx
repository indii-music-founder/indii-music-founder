'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';

function WaveformTunnel() {
    const group = useRef<THREE.Group>(null!);

    const lines = useMemo(() => {
        return new Array(20).fill(0).map((_, i) => ({
            z: -i * 2,
            scale: 1 + i * 0.1,
            speed: 0.5 + Math.random() * 0.5
        }));
    }, []);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Animate tunnel movement
        group.current.position.z = (time * 2) % 2;
    });

    return (
        <group ref={group}>
            {lines.map((line, i) => (
                <Line
                    key={i}
                    points={new Array(50).fill(0).map((_, j) => {
                        const x = (j - 25) * 0.2;
                        const y = Math.sin(x * 0.5 + i) * 0.5; // Static wave for now, animated in shader/ref if needed
                        return [x, y, 0] as [number, number, number];
                    })}
                    color="#00f3ff"
                    transparent
                    opacity={0.3}
                    position={[0, 0, line.z]}
                />
            ))}

            {/* Floating Analysis Labels */}
            <Text position={[-2, 1, -5]} color="#00ff9d" fontSize={0.2}>
                [BPM: 128]
            </Text>
            <Text position={[2, -1, -8]} color="#b026ff" fontSize={0.2}>
                [Key: F# Minor]
            </Text>
            <Text position={[0, 2, -12]} color="#00f3ff" fontSize={0.2}>
                [Mood: Nostalgic]
            </Text>
        </group>
    );
}

export default function DeepListening() {
    return (
        <section className="h-screen w-full relative bg-obsidian flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
                    <fog attach="fog" args={['#0a0a0a', 5, 20]} />
                    <WaveformTunnel />
                </Canvas>
            </div>

            <div className="z-10 text-center pointer-events-none max-w-4xl px-6">
                <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                    Deep Listening
                </h2>
                <p className="text-xl md:text-2xl text-white/70 font-light mb-8">
                    The AI doesn't just hear; it fingerprints. From raw audio chaos to structured creative order.
                </p>
                <div className="text-neon-blue text-lg tracking-widest uppercase">
                    It listens. It learns. It creates.
                </div>
            </div>
        </section>
    );
}
