'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useScroll, Text } from '@react-three/drei';

export default function TheTitan() {
    const meshRef = useRef<THREE.Mesh>(null!);
    const textRef = useRef<THREE.Group>(null!);
    const scroll = useScroll();
    const { camera } = useThree();
    const [triggered, setTriggered] = useState(false);

    // Audio effect for the impact (optional, but adds to the feel)
    // We'll just use visual shock for now

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const offset = scroll.offset; // 0 to 1

        // Trigger logic: Very end of scroll
        if (offset > 0.98 && !triggered) {
            setTriggered(true);
            // Instant camera shake or flash could go here
        } else if (offset < 0.95 && triggered) {
            setTriggered(false);
        }

        if (triggered) {
            // "The Manifestation"
            // Scale up instantly with a bounce
            meshRef.current.scale.lerp(new THREE.Vector3(15, 15, 15), 0.2);

            // Rotate aggressively
            meshRef.current.rotation.x = t * 2;
            meshRef.current.rotation.y = t * 3;

            // Pulse color
            if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
                meshRef.current.material.emissiveIntensity = 2 + Math.sin(t * 20) * 1;
                meshRef.current.material.color.setHSL((t * 0.5) % 1, 1, 0.5);
            }

            // Camera Shake
            camera.position.x += (Math.random() - 0.5) * 0.2;
            camera.position.y += (Math.random() - 0.5) * 0.2;

            // Text Reveal
            if (textRef.current) {
                textRef.current.visible = true;
                textRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
            }

        } else {
            // Dormant state
            meshRef.current.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            if (textRef.current) {
                textRef.current.visible = false;
                textRef.current.scale.set(0, 0, 0);
            }
        }
    });

    return (
        <group position={[0, -84, 0]}> {/* Positioned way below everything else */}
            <mesh ref={meshRef}>
                <torusKnotGeometry args={[1, 0.3, 128, 32]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#ff0000"
                    emissiveIntensity={0}
                    roughness={0.1}
                    metalness={1}
                    wireframe={false}
                />
            </mesh>

            <group ref={textRef} position={[0, 0, 0]} visible={false}>
                <Text
                    position={[0, 2, 0]}
                    fontSize={2}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    OWN
                </Text>
                <Text
                    position={[0, 0, 0]}
                    fontSize={2}
                    color="#ff0000" // Red for impact
                    anchorX="center"
                    anchorY="middle"
                >
                    YOUR FUTURE
                </Text>
            </group>

            {/* Dramatic Lighting just for this section */}
            {triggered && (
                <pointLight position={[0, 0, 10]} intensity={10} color="white" distance={20} />
            )}
        </group>
    );
}
