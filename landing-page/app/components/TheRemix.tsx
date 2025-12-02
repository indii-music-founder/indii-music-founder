'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance, Points, PointMaterial, Float } from '@react-three/drei';
import { useAudioStore } from '../store/audioStore';

// --- REMIX 1: THE GLITCH EMPIRE (Evolved SecurityGrid) ---
// Concept: A fracturing reality. 3 nested wireframes spinning in chaos.
function RemixVault() {
    const group = useRef<THREE.Group>(null!);
    const mesh1 = useRef<THREE.Mesh>(null!);
    const mesh2 = useRef<THREE.Mesh>(null!);
    const mesh3 = useRef<THREE.Mesh>(null!);

    // Audio Reactivity
    const bass = useAudioStore((state) => state.frequencyData.bass) || 0;

    useFrame((state) => {
        if (!mesh1.current || !mesh2.current || !mesh3.current) return;
        const t = state.clock.getElapsedTime();

        // Layer 1: The Core (Fast Spin)
        mesh1.current.rotation.x = t * 2;
        mesh1.current.rotation.y = t * 3;
        mesh1.current.scale.setScalar(1 + bass * 2); // Heavy pulse

        // Layer 2: The Shell (Reverse Slow Spin)
        mesh2.current.rotation.x = -t * 0.5;
        mesh2.current.rotation.z = t * 0.5;
        mesh2.current.scale.setScalar(2 + Math.sin(t * 5) * 0.2);

        // Layer 3: The Glitch Field (Chaotic)
        mesh3.current.rotation.y = t * 0.2;
        mesh3.current.rotation.z = Math.sin(t) * 0.5;

        // Random glitch jumps for outer layer
        if (Math.random() > 0.9) {
            mesh3.current.scale.setScalar(3 + Math.random());
        } else {
            mesh3.current.scale.lerp(new THREE.Vector3(3, 3, 3), 0.1);
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]}>
            {/* Core */}
            <mesh ref={mesh1}>
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.8} />
            </mesh>
            {/* Shell */}
            <mesh ref={mesh2}>
                <icosahedronGeometry args={[1, 1]} />
                <meshBasicMaterial color="#ff0055" wireframe transparent opacity={0.3} />
            </mesh>
            {/* Glitch Field */}
            <mesh ref={mesh3}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.1} />
            </mesh>
        </group>
    );
}

// --- REMIX 2: THE NEURAL WEB (Evolved Business) ---
// Concept: A breathing, living organism of data.
function RemixNetwork() {
    const pointsRef = useRef<THREE.Points>(null!);
    const linesRef = useRef<THREE.LineSegments>(null!);
    const mid = useAudioStore((state) => state.frequencyData.mid) || 0;

    const count = 200;
    const radius = 6;

    const { positions, linePositions } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const linePos: number[] = [];
        const vecPositions: THREE.Vector3[] = [];

        for (let i = 0; i < count; i++) {
            const theta = THREE.MathUtils.randFloatSpread(360);
            const phi = THREE.MathUtils.randFloatSpread(360);

            const x = radius * Math.sin(theta) * Math.cos(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(theta);

            pos[i * 3] = x;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = z;
            vecPositions.push(new THREE.Vector3(x, y, z));
        }

        // Connect nearby points
        vecPositions.forEach((p1, i) => {
            vecPositions.forEach((p2, j) => {
                if (i < j && p1.distanceTo(p2) < 3.5) {
                    linePos.push(p1.x, p1.y, p1.z);
                    linePos.push(p2.x, p2.y, p2.z);
                }
            });
        });

        if (linePos.length === 0) linePos.push(0, 0, 0, 0, 0, 0);

        return { positions: pos, linePositions: new Float32Array(linePos) };
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();

        // Breathing effect
        const breath = 1 + Math.sin(t * 2) * 0.1 + mid * 0.5;

        if (pointsRef.current) {
            pointsRef.current.rotation.y = -t * 0.2;
            pointsRef.current.rotation.z = t * 0.1;
            pointsRef.current.scale.setScalar(breath);
        }
        if (linesRef.current) {
            linesRef.current.rotation.y = -t * 0.2;
            linesRef.current.rotation.z = t * 0.1;
            linesRef.current.scale.setScalar(breath);
        }
    });

    return (
        <group position={[0, -12, 0]}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <Points ref={pointsRef} positions={positions} stride={3}>
                    <PointMaterial color="#0088ff" size={0.15} transparent opacity={0.9} sizeAttenuation={true} depthWrite={false} />
                </Points>
                <lineSegments ref={linesRef}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} args={[linePositions, 3]} />
                    </bufferGeometry>
                    <lineBasicMaterial color="#0044aa" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
                </lineSegments>
            </Float>
        </group>
    );
}

// --- REMIX 3: THE DATA TORRENT (Evolved Commerce) ---
// Concept: A double-helix DNA strand of pure value.
function RemixStream() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 300;
    const high = useAudioStore((state) => state.frequencyData.high) || 0;

    const particles = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => ({
            strand: i % 2 === 0 ? 1 : -1, // Two strands
            y: (Math.random() - 0.5) * 30,
            speed: Math.random() * 0.5 + 0.5,
            offset: Math.random() * Math.PI * 2
        }));
    }, []);

    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();
        const speedMult = 1 + high * 4;

        particles.forEach((p, i) => {
            // DNA Helix Motion
            const angle = (p.y * 0.5) + (t * p.speed); // Twist based on height + time
            const radius = 4 + Math.sin(t * 2 + p.y) * 1; // Breathing radius

            const x = Math.cos(angle) * radius * p.strand; // Strand separation
            const z = Math.sin(angle) * radius * p.strand;
            const y = (p.y + t * 5 * speedMult) % 30 - 15; // Fast upward flow

            dummy.position.set(x, y, z);

            // Spin individual particles
            dummy.rotation.set(t * 2, t * 3, t);

            // Scale with highs
            const scale = (0.2 + high * 0.5) * (1 + Math.sin(t * 10 + i) * 0.5);
            dummy.scale.setScalar(scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <group position={[0, -24, 0]}>
            <Instances range={count} ref={meshRef}>
                <tetrahedronGeometry args={[0.3]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#b0e0ff" // Platinum/Ice Blue
                    emissiveIntensity={1}
                    metalness={1}
                    roughness={0}
                />
                {particles.map((_, i) => <Instance key={i} />)}
            </Instances>
        </group>
    );
}

export default function TheRemix() {
    return (
        <group position={[0, -96, 0]}> {/* Starts after Titan (-84) */}
            <RemixVault />
            <RemixNetwork />
            <RemixStream />

            {/* Ambient lighting for the remix section */}
            <pointLight position={[0, 0, 0]} intensity={2} color="#ffffff" distance={30} />
            <pointLight position={[0, -20, 0]} intensity={2} color="#0088ff" distance={30} />
        </group>
    );
}
