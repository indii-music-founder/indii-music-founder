'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';

import { Instance, Instances } from '@react-three/drei';

function DataTunnel() {
    const group = useRef<THREE.Group>(null!);

    // Create data points for the tunnel
    const dataPoints = useMemo(() => {
        return new Array(100).fill(0).map((_, i) => ({
            position: [
                Math.sin(i * 0.5) * 3,
                Math.cos(i * 0.5) * 3,
                -i * 0.5
            ] as [number, number, number],
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
            scale: Math.random() * 0.5 + 0.2
        }));
    }, []);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        // Move the tunnel towards the camera
        group.current.position.z = (time * 5) % 50;
    });

    return (
        <group ref={group}>
            <Instances range={100}>
                <boxGeometry args={[0.1, 0.1, 1]} />
                <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2} />

                {dataPoints.map((data, i) => (
                    <Instance
                        key={i}
                        position={data.position}
                        rotation={data.rotation}
                        scale={data.scale}
                    />
                ))}
            </Instances>

            {/* Central Beam */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 100, 8]} />
                <meshBasicMaterial color="#b026ff" transparent opacity={0.2} />
            </mesh>
        </group>
    );
}

export default function DeepListening() {
    return (
        <group position={[0, -10, 0]}>
            <fog attach="fog" args={['#0a0a0a', 5, 20]} />
            <DataTunnel />
        </group>
    );
}
