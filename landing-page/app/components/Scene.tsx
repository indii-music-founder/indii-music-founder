'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, Scroll, useScroll } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import Effects from './Effects';
import Hero from './Hero';
import DeepListening from './DeepListening';
import AgentZero from './AgentZero';
import Business from './Business';
import Commerce from './Commerce';
import Overlays from './Overlays';

function CameraRig() {
    const scroll = useScroll();
    useFrame((state) => {
        // Move camera down as we scroll
        // Total height is roughly 40 units (5 sections * 10 units apart approx)
        // scroll.offset goes from 0 to 1
        const targetY = -scroll.offset * 40;

        // Smoothly interpolate camera position
        state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.1);

        // Optional: Add some subtle mouse parallax or rotation here later
    });
    return null;
}

export default function Scene() {
    return (
        <div className="h-screen w-full bg-black">
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }} dpr={[1, 2]}>
                <Suspense fallback={null}>
                    <ScrollControls pages={5} damping={0.2}>
                        <CameraRig />

                        {/* 3D Content Layer */}
                        <Scroll>
                            <Hero />
                            <DeepListening />
                            <AgentZero />
                            <Business />
                            <Commerce />
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
