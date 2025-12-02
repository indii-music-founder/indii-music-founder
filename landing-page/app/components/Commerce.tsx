'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import { useAudioStore } from '../store/audioStore';

function ValueStream() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 800; // More particles for immersion

    // Audio Reactivity
    const high = useAudioStore((state) => state.frequencyData.high) || 0;

    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => {
            // Create a "tunnel" distribution
            const r = 5 + Math.random() * 20; // Radius from center (5 to 25)
            const theta = Math.random() * Math.PI * 2; // Angle around center

            return {
                x: Math.cos(theta) * r,
                y: Math.sin(theta) * r,
                z: -50 - Math.random() * 50, // Start deeper back
                speed: Math.random() * 0.2 + 0.1,
                rotationSpeed: Math.random() * 2,
                scale: Math.random() * 0.5 + 0.2 // Larger chunks
            };
        });
    }, []);

    useFrame((state) => {
        if (!meshRef.current) return;

        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        // Speed up with Highs
        const speedMultiplier = 1 + high * 5;

        particles.forEach((p, i) => {
            // Move towards camera (Z+)
            // We use a modulo to loop them continuously without a hard reset check
            // This creates a smoother infinite stream
            const travelDist = t * p.speed * 20 * speedMultiplier;
            let z = (p.z + travelDist) % 60; // Loop within 60 units

            // Shift range to be from -40 to +20 (past camera)
            z = z - 40;
            if (z > 10) z -= 60; // Wrap around if too close

            // Spiral motion around the tunnel
            const angle = t * 0.2 + i;
            const x = p.x * Math.cos(angle) - p.y * Math.sin(angle);
            const y = p.x * Math.sin(angle) + p.y * Math.cos(angle);

            dummy.position.set(x, y, z);
            dummy.rotation.set(
                t * p.rotationSpeed,
                t * p.rotationSpeed,
                t * p.rotationSpeed
            );
            dummy.scale.setScalar(p.scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <octahedronGeometry args={[1, 0]} />
            <meshPhysicalMaterial
                color="#ffd700" // Gold
                emissive="#ffaa00"
                emissiveIntensity={0.2}
                metalness={1}
                roughness={0.1}
                transmission={0.2}
                thickness={1}
                clearcoat={1}
            />
            {particles.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

export default function Commerce() {
    return (
        <group position={[0, -72, 0]}>
            <ambientLight intensity={0.5} />
            <pointLight position={[0, 0, 0]} intensity={2} color="#ffd700" distance={20} />
            <ValueStream />
        </group>
    );
}
