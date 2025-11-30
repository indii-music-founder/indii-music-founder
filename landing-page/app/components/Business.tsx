'use client';

import { useFrame } from '@react-three/fiber';
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
        <group position={[0, -30, 0]}>
            <HolographicGlobe />
        </group>
    );
}
