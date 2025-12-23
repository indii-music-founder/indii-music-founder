/* eslint-disable react-hooks/purity */
'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances, useScroll } from '@react-three/drei';

import { Trail } from '@react-three/drei';

function ZappingLaser() {
    const laserRef = useRef<THREE.Mesh>(null!);
    const scroll = useScroll();

    // State for chaotic movement
    const targetPos = useRef(new THREE.Vector3(0, 0, 0));
    const currentPos = useRef(new THREE.Vector3(0, 0, 0));

    useFrame((state, delta) => {
        const scrollIntensity = Math.min(Math.abs(scroll.delta) * 500, 1);

        // "Zip Zap" Logic
        // Every few frames, pick a new random target
        if (Math.random() < 0.05 + (scrollIntensity * 0.2)) {
            targetPos.current.set(
                (Math.random() - 0.5) * 10, // X: Wide range
                (Math.random() - 0.5) * 6,  // Y: Medium range
                (Math.random() - 0.5) * 5   // Z: Depth
            );
        }

        // Move towards target very fast (zip)
        currentPos.current.lerp(targetPos.current, 0.2 + (scrollIntensity * 0.5));

        // Add some noise/shake
        const shake = 0.1 + scrollIntensity * 0.5;
        laserRef.current.position.x = currentPos.current.x + (Math.random() - 0.5) * shake;
        laserRef.current.position.y = currentPos.current.y + (Math.random() - 0.5) * shake;
        laserRef.current.position.z = currentPos.current.z;

        // Rotate the laser head
        laserRef.current.rotation.z += delta * 10;
        laserRef.current.rotation.x += delta * 5;
    });

    return (
        <group>
            {/* The Trail */}
            <Trail
                width={0.4} // Width of the line
                length={12} // Length of the trail
                color={new THREE.Color("#00ffff")} // Cyan
                attenuation={(t) => t * t} // Taper width
            >
                {/* The Laser Head */}
                <mesh ref={laserRef}>
                    <octahedronGeometry args={[0.2, 0]} />
                    <meshBasicMaterial color="#ffffff" toneMapped={false} />
                    <pointLight intensity={2} distance={5} color="#00ffff" />
                </mesh>
            </Trail>

            {/* Secondary Trail (Purple) for extra "fun" */}
            <Trail
                width={0.2}
                length={8}
                color={new THREE.Color("#b026ff")}
                attenuation={(t) => t}
                target={laserRef} // Follow the same mesh
            />
        </group>
    );
}

function BackgroundParticles() {
    const count = 200;
    const mesh = useRef<THREE.InstancedMesh>(null!);

    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            // eslint-disable-next-line react-hooks/purity
            position: [
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 40
            ] as [number, number, number],
            // eslint-disable-next-line react-hooks/purity
            scale: Math.random() * 0.5 + 0.1
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        particles.forEach((p, i) => {
            const dummy = new THREE.Object3D();
            // Simple floating
            dummy.position.set(
                p.position[0],
                p.position[1],
                p.position[2] + Math.sin(t + i) * 2
            );
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={mesh}>
            <dodecahedronGeometry args={[0.1, 0]} />
            <meshBasicMaterial color="#444444" transparent opacity={0.3} />
            {particles.map((_, i) => <Instance key={i} />)}
        </Instances>
    );
}

export default function DeepListening() {
    return (
        <group position={[0, -16, 0]}>
            <fog attach="fog" args={['#000000', 5, 30]} />
            <BackgroundParticles />
            <ZappingLaser />
        </group>
    );
}
