'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useScroll, Text, Float } from '@react-three/drei';

export default function TheTitan() {
    const meshRef = useRef<THREE.Mesh>(null!);
    const textRef = useRef<THREE.Group>(null!);
    const scroll = useScroll();
    const { camera } = useThree();
    const [triggered, setTriggered] = useState(false);

    useFrame((state) => {
        if (!meshRef.current) return;

        const t = state.clock.getElapsedTime();
        const offset = scroll.offset; // 0 to 1

        // Trigger logic: Very end of scroll
        if (offset > 0.98 && !triggered) {
            setTriggered(true);
        } else if (offset < 0.95 && triggered) {
            setTriggered(false);
        }

        if (triggered) {
            // "The Manifestation"
            // Scale up instantly 
            meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);

            // Slow rotation
            meshRef.current.rotation.y = t * 0.2;

            // Camera Shake
            // eslint-disable-next-line react-hooks/immutability
            camera.position.x += (Math.random() - 0.5) * 0.05;
            camera.position.y += (Math.random() - 0.5) * 0.05;

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

            {/* The Monolith - Massive Obsidian Diamond */}
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh ref={meshRef} scale={[0, 0, 0]}>
                    <octahedronGeometry args={[8, 0]} />
                    <meshPhysicalMaterial
                        color="#000000"
                        roughness={0}
                        metalness={1}
                        clearcoat={1}
                        clearcoatRoughness={0}
                        reflectivity={1}
                        emissive="#ffffff"
                        emissiveIntensity={0.1}
                    />
                </mesh>
            </Float>

            <group ref={textRef} position={[0, 0, 2]} visible={false} scale={[0, 0, 0]}>
                <Text
                    position={[0, 0, 0]}
                    fontSize={2}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    letterSpacing={0.2}
                >
                    OWN YOUR FUTURE
                </Text>

            </group>

            {/* Dramatic Lighting */}
            {triggered && (
                <>
                    <pointLight position={[0, 0, 10]} intensity={5} color="white" distance={20} />
                    <pointLight position={[-10, 10, 5]} intensity={5} color="#b026ff" distance={30} />
                    <pointLight position={[10, -10, 5]} intensity={5} color="#00f3ff" distance={30} />
                </>
            )}
        </group>
    );
}
