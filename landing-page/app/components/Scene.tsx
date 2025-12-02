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

import TheRemix from './TheRemix';

function CameraRig() {
    const scroll = useScroll();
    useFrame((state) => {
        // Move camera down as we scroll
        // Total height compressed to ~130 units (extended for Remix)
        // scroll.offset goes from 0 to 1
        const targetY = -scroll.offset * 130;

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

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        // Base color based on scroll
        if (meshRef.current.material instanceof THREE.MeshBasicMaterial) {
            const targetColor = new THREE.Color();
            if (scrollOffset < 0.1) targetColor.set('#00f3ff'); // Hero
            else if (scrollOffset < 0.2) targetColor.set('#b026ff'); // Deep Listening
            else if (scrollOffset < 0.3) targetColor.set('#ff00ff'); // Agent Zero
            else if (scrollOffset < 0.4) targetColor.set('#ff0088'); // Neural Forge
            else if (scrollOffset < 0.5) targetColor.set('#ff0000'); // Security Grid (Empire)
            else if (scrollOffset < 0.6) targetColor.set('#00ff9d'); // Business (Global Network)
            else if (scrollOffset < 0.7) targetColor.set('#ffd700'); // Commerce (Value Stream)
            else if (scrollOffset < 0.8) targetColor.set('#ffffff'); // The Titan (Monolith)
            else if (scrollOffset < 0.9) targetColor.set('#0088ff'); // The Remix (Deep Blue)
            else targetColor.set('#ffffff'); // Final Fade (Platinum)

            meshRef.current.material.color.lerp(targetColor, 0.05);
            color.copy(meshRef.current.material.color);
        }

        particles.forEach((p, i) => {
            // Base movement
            const y = p.position[1] + Math.sin(t * p.speed + p.phase) * 0.5;

            // Scroll reactivity
            const turbulence = Math.abs(scroll.delta) * 50;
            const x = p.position[0] + Math.cos(t * 0.5 + p.phase) * (0.5 + turbulence);
            const z = p.position[2] + Math.sin(t * 0.3 + p.phase) * (0.5 + turbulence);

            dummy.position.set(x, y, z);

            // Twinkle effect
            const twinkle = Math.sin(t * 5 + p.phase * 10) * 0.5 + 0.5;
            const scale = p.scale * (1 + turbulence) * (0.5 + twinkle); // Pulse size

            dummy.scale.setScalar(scale);
            dummy.rotation.x += 0.02;
            dummy.rotation.z += 0.02;
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // We could set instance color here for individual twinkling if we switched to instanceColor
            // But scaling is a good enough "sparkle" effect for now combined with the shape
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial
                transparent
                opacity={0.8}
                toneMapped={false} // Make them bright/bloom
            />
            {particles.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

import ThreeDOrbs from './ThreeDOrbs';

export default function Scene() {
    return (
        <div className="h-screen w-full bg-black relative">
            <AudioManager />
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }} dpr={[1, 2]}>
                <Suspense fallback={null}>
                    <ThreeDOrbs />
                    <ScrollControls pages={11} damping={0.2}>
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
                            <TheRemix />

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
