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
import { audioStore } from '../store/audioStore';

import ThreeDOrbs from './ThreeDOrbs';
import AudioRing from './AudioRing';
import OrigamiParticles from './OrigamiParticles';

function CameraRig() {
    const scroll = useScroll();
    // const { frequencyData } = useAudioStore(); // Removed

    useFrame((state) => {
        // Move camera down as we scroll
        // Total height compressed to ~130 units (extended for Remix)
        // scroll.offset goes from 0 to 1
        const targetY = -scroll.offset * 130;
        const { frequencyData } = audioStore.getState(); // Updated
        const { bass } = frequencyData;

        // Smoothly interpolate camera position
        // Add bass kick to Y position for a "bump" effect
        const bassOffset = bass * 0.25;

        // Add subtle shake on X/Z based on bass
        const shakeX = (Math.random() - 0.5) * bass * 0.05;
        const shakeZ = (Math.random() - 0.5) * bass * 0.05;

        const currentY = THREE.MathUtils.lerp(state.camera.position.y, targetY - bassOffset, 0.1);

        state.camera.position.set(
            shakeX,
            currentY,
            5 + shakeZ // Base Z is 5
        );

        // Optional: Add some subtle mouse parallax or rotation here later
    });
    return null;
}

function NeuralAether() {
    const count = 1000;
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const scroll = useScroll();

    // Generate particles with band assignments
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const t = Math.random() * 100;
            const factor = 20 + Math.random() * 100;
            const speed = 0.01 + Math.random() / 200;
            const xFactor = -50 + Math.random() * 100;
            const yFactor = -50 + Math.random() * 100;
            const zFactor = -50 + Math.random() * 100;
            // Assign each particle to a band (0-30)
            const bandIndex = i % 31;
            temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0, bandIndex });
        }
        return temp;
    }, [count]);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const scrollOffset = scroll.offset; // 0 to 1
        const { frequencyData } = audioStore.getState();
        const { bands } = frequencyData;

        // Base color based on scroll
        if (meshRef.current && meshRef.current.material instanceof THREE.MeshBasicMaterial) {
            const targetColor = new THREE.Color();
            if (scrollOffset < 0.1) targetColor.set('#00f3ff'); // Hero
            else if (scrollOffset < 0.3) targetColor.set('#ffffff'); // Deep Listening
            else if (scrollOffset < 0.5) targetColor.set('#00f3ff'); // Agent Zero
            else if (scrollOffset < 0.7) targetColor.set('#ffffff'); // The Remix
            else targetColor.set('#ffffff'); // Final Fade (Platinum)

            // Audio reactive color shift
            // Use the average of high bands to shift towards purple/pink
            const highEnergy = bands.slice(20).reduce((a, b) => a + b, 0) / 11;
            if (highEnergy > 0.1) {
                targetColor.lerp(new THREE.Color('#ff00ff'), highEnergy * 0.8);
            }

            meshRef.current.material.color.lerp(targetColor, 0.05);
        }

        particles.forEach((p, i) => {
            // Base movement
            const y = p.yFactor + Math.sin(t * p.speed + p.t) * 0.5;

            // Scroll reactivity
            const turbulence = Math.abs(scroll.delta) * 50;
            const x = p.xFactor + Math.cos(t * 0.5 + p.t) * (0.5 + turbulence);
            const z = p.zFactor + Math.sin(t * 0.3 + p.t) * (0.5 + turbulence);

            // Audio Reactivity
            // Get the band value for this particle
            const bandValue = bands[p.bandIndex] || 0;

            // Modulate scale based on band value
            const audioScale = 1 + (bandValue * 5); // Scale up to 6x

            dummy.position.set(x, y, z);
            dummy.scale.setScalar(audioScale);

            // Continuous rotation
            dummy.rotation.set(
                t * p.speed,
                t * p.speed,
                t * p.speed
            );

            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
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



export default function Scene() {
    return (
        <div className="h-screen w-full bg-black relative">
            <AudioManager />
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }} dpr={[1, 2]}>
                <Suspense fallback={null}>
                    {/* <ThreeDOrbs /> */}
                    {/* <AudioRing /> */}
                    {/* <OrigamiParticles /> */}
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
                            {/* <NeuralAether /> */}
                        </Scroll>

                        {/* HTML Overlay Layer (Text) */}
                        <Scroll html style={{ width: '100%' }}>
                            <Overlays />
                        </Scroll>
                    </ScrollControls>

                    <Effects />
                </Suspense>
            </Canvas>
        </div >
    );
}
