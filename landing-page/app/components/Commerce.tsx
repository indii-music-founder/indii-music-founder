'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances, Float } from '@react-three/drei';

function QuantumMerchant() {
    const group = useRef<THREE.Group>(null!);
    const [mode, setMode] = useState(0); // 0: Wireframe, 1: Points, 2: Solid

    useFrame((state) => {
        const t = state.clock.getElapsedTime();

        // Glitch switch modes
        if (Math.random() > 0.98) {
            setMode(Math.floor(Math.random() * 3));
        }

        // Rotate group
        group.current.rotation.y = t * 0.5;
    });

    return (
        <group ref={group}>
            {/* Core Figure */}
            <mesh>
                <capsuleGeometry args={[1, 2, 4, 8]} />
                {mode === 0 && <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.3} />}
                {mode === 1 && <pointsMaterial color="#b026ff" size={0.05} sizeAttenuation />}
                {mode === 2 && (
                    <meshStandardMaterial
                        color="#ffffff"
                        metalness={0.9}
                        roughness={0.1}
                        emissive="#00f3ff"
                        emissiveIntensity={0.5}
                    />
                )}
            </mesh>

            {/* Inner Energy */}
            <mesh scale={0.8}>
                <capsuleGeometry args={[1, 2, 4, 8]} />
                <meshBasicMaterial color="#b026ff" transparent opacity={0.2} />
            </mesh>
        </group>
    );
}

function HolographicArtifacts() {
    const count = 8;
    const artifacts = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => ({
            position: [
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 8
            ] as [number, number, number],
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
            scale: Math.random() * 0.5 + 0.2
        }));
    }, []);

    const group = useRef<THREE.Group>(null!);

    useFrame((state) => {
        group.current.rotation.y = -state.clock.getElapsedTime() * 0.2;
    });

    return (
        <group ref={group}>
            {artifacts.map((art, i) => (
                <Float key={i} speed={2} rotationIntensity={2} floatIntensity={2}>
                    <mesh position={art.position} rotation={art.rotation} scale={art.scale}>
                        <boxGeometry />
                        <meshBasicMaterial color={i % 2 === 0 ? "#00f3ff" : "#b026ff"} wireframe />
                    </mesh>
                </Float>
            ))}
        </group>
    );
}

export default function Commerce() {
    return (
        <group position={[0, -72, 0]}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={2} />
            <pointLight position={[-10, -10, -10]} color="#b026ff" intensity={2} />

            <QuantumMerchant />
            <HolographicArtifacts />
        </group>
    );
}
