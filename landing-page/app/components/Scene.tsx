'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, Scroll, useScroll, Instance, Instances } from '@react-three/drei';
import { Suspense, useRef, useMemo } from 'react';
import * as THREE from 'three';
import Effects from './Effects';
import Hero from './Hero';
import DeepListening from './DeepListening';
import AgentZero from './AgentZero';
import NeuralForge from './NeuralForge';
import SecurityGrid from './SecurityGrid';
import Business from './Business';
import Commerce from './Commerce';
import TheTitan from './TheTitan';
import Overlays from './Overlays';
import AudioManager from './AudioManager';

function CameraRig() {
    const scroll = useScroll();
    useFrame((state) => {
        // Move camera down as we scroll
        // Total height compressed to ~96 units
        // scroll.offset goes from 0 to 1
        const targetY = -scroll.offset * 96;

        // Smoothly interpolate camera position
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.1);

        // Optional: Add some subtle mouse parallax or rotation here later
    });
    return null;
}

function NeuralAether() {
    const count = 1000;
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const scroll = useScroll();

    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            position: [
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 120, // Reduced spread
                (Math.random() - 0.5) * 20
            ] as [number, number, number],
            scale: Math.random() * 0.05 + 0.02,
            speed: Math.random() * 0.2 + 0.1,
            phase: Math.random() * Math.PI * 2
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const scrollOffset = scroll.offset; // 0 to 1

        // Determine global mood based on scroll depth
        // Compressed timeline

        const dummy = new THREE.Object3D();

        particles.forEach((p, i) => {
            // Base movement
            const y = p.position[1] + Math.sin(t * p.speed + p.phase) * 0.5;

            // Scroll reactivity
            // Add turbulence based on scroll speed
            const turbulence = Math.abs(scroll.delta) * 50;
            const x = p.position[0] + Math.cos(t * 0.5 + p.phase) * (0.5 + turbulence);
            const z = p.position[2] + Math.sin(t * 0.3 + p.phase) * (0.5 + turbulence);

            dummy.position.set(x, y, z);
            dummy.scale.setScalar(p.scale * (1 + turbulence));
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;

        // Color shift based on depth
        if (meshRef.current.material instanceof THREE.MeshBasicMaterial) {
            const color = new THREE.Color();
            // Adjusted thresholds for 10 pages / 9 sections
            if (scrollOffset < 0.1) color.set('#00f3ff'); // Hero
            else if (scrollOffset < 0.2) color.set('#b026ff'); // Deep Listening
            else if (scrollOffset < 0.3) color.set('#ff00ff'); // Agent Zero
            else if (scrollOffset < 0.4) color.set('#ff0088'); // Neural Forge
            else if (scrollOffset < 0.5) color.set('#00ff00'); // Security Grid
            else if (scrollOffset < 0.6) color.set('#ffaa00'); // Space Battle
            else if (scrollOffset < 0.7) color.set('#ffffff'); // Commerce
            else if (scrollOffset < 0.85) color.set('#ff0000'); // The Titan
            else color.set('#ffd700'); // Outro (Gold)

            meshRef.current.material.color.lerp(color, 0.05);
        }
    });

    return (
        <Instances range={count} ref={meshRef}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial transparent opacity={0.4} />
            {particles.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

export default function Scene() {
    return (
        <div className="h-screen w-full bg-black">
            <AudioManager />
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }} dpr={[1, 2]}>
                <Suspense fallback={null}>
                    <ScrollControls pages={10} damping={0.2}>
                        <CameraRig />

                        {/* 3D Content Layer */}
                        <Scroll>
                            <Hero />
                            <DeepListening />
                            <AgentZero />
                            <NeuralForge />
                            <SecurityGrid />
                            <Business />
                            <Commerce />
                            <TheTitan />

                            {/* Global Atmosphere */}
                            <NeuralAether />
                        </Scroll>

                        {/* HTML Overlay Layer (Text) */}
                        <Scroll html style={{ width: '100%' }}>
                            <Overlays />
                        </Scroll>
                    </ScrollControls>

                    <Effects />
                </Suspense>
            </Canvas>
        </div>
    );
}
