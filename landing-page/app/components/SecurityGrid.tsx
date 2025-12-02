'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';

import { useAudioStore } from '../store/audioStore';

function LaserGrid() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 40;

    const beams = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => ({
            y: (i - count / 2) * 0.5,
            speed: Math.random() * 0.5 + 0.2,
            offset: Math.random() * Math.PI * 2
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        beams.forEach((beam, i) => {
            // Vertical flow
            const y = beam.y + Math.sin(t * beam.speed + beam.offset) * 0.2;

            // Forward/Backward Wave
            const z = Math.sin(t * 1.5 + beam.y * 2) * 3;

            dummy.position.set(0, y, z);
            dummy.rotation.x = Math.cos(t * 1.5 + beam.y * 2) * 0.1;
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <boxGeometry args={[30, 0.05, 0.05]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.8} toneMapped={false} />
            {beams.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

function Scanner() {
    const mesh = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.position.y = Math.sin(t) * 8;
        mesh.current.scale.x = 30;
        mesh.current.scale.z = 1 + Math.sin(t * 10) * 0.1;
    });

    return (
        <mesh ref={mesh} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.1} side={THREE.DoubleSide} />
        </mesh>
    );
}

function HexShields() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 20;

    const hexes = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            position: [
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 5
            ] as [number, number, number],
            rotation: [
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                0
            ] as [number, number, number],
            scale: Math.random() * 0.5 + 0.5
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        hexes.forEach((hex, i) => {
            dummy.position.set(...hex.position);
            dummy.rotation.set(
                hex.rotation[0] + t * 0.2,
                hex.rotation[1] + t * 0.3,
                hex.rotation[2]
            );
            dummy.scale.setScalar(hex.scale * (1 + Math.sin(t * 2 + i) * 0.2));
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <circleGeometry args={[1, 6]} />
            <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.2} />
            {hexes.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

function DataVault() {
    const group = useRef<THREE.Group>(null!);
    const coreMat = useRef<THREE.MeshStandardMaterial>(null!);
    const ring1 = useRef<THREE.Mesh>(null!);
    const ring2 = useRef<THREE.Mesh>(null!);

    // Audio Reactivity
    const bass = useAudioStore((state) => state.frequencyData.bass);
    const high = useAudioStore((state) => state.frequencyData.high);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();

        // Core Pulsate (Bass)
        const pulse = 1 + bass * 0.5;
        if (coreMat.current) {
            coreMat.current.emissiveIntensity = 0.5 + bass * 2;
            coreMat.current.color.setHSL(0, 1, 0.2 + bass * 0.3); // Red pulse
        }

        // Rings "Racing" Effect (Highs)
        // We simulate "racing" by spinning faster with highs
        const raceSpeed = 0.2 + high * 2;

        if (ring1.current) {
            ring1.current.rotation.z += raceSpeed * 0.05;
            ring1.current.rotation.x = Math.PI / 2 + Math.sin(t) * 0.2;
        }
        if (ring2.current) {
            ring2.current.rotation.z -= raceSpeed * 0.05;
            ring2.current.rotation.z += 0.01;
        }

        group.current.position.y = Math.sin(t * 0.5) * 0.5;
    });

    return (
        <group ref={group}>
            {/* Core - Solid Pulsating Base */}
            <mesh scale={2}>
                <icosahedronGeometry args={[1, 4]} /> {/* Higher detail for solid look */}
                <meshStandardMaterial
                    ref={coreMat}
                    color="#330000"
                    emissive="#ff0000"
                    emissiveIntensity={0.5}
                    roughness={0.4}
                    metalness={0.8}
                />
            </mesh>

            {/* Outer Casing - Dark Purple/Black with Neon Purple */}
            {/* Ring 1 */}
            <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[3, 0.1, 16, 100]} />
                <meshStandardMaterial
                    color="#0a0010" // Almost black
                    emissive="#b026ff" // Neon Purple
                    emissiveIntensity={2}
                    roughness={0.1}
                    metalness={1}
                />
            </mesh>

            {/* Ring 2 */}
            <mesh ref={ring2} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[3.5, 0.05, 16, 100]} />
                <meshStandardMaterial
                    color="#000000"
                    emissive="#8a2be2"
                    emissiveIntensity={1}
                    roughness={0.1}
                    metalness={1}
                />
            </mesh>

            {/* Energy Field */}
            <mesh scale={2.5}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color="#ff0000" transparent opacity={0.05} side={THREE.BackSide} />
            </mesh>
        </group>
    );
}

export default function SecurityGrid() {
    return (
        <group position={[0, -48, 0]}>
            <LaserGrid />
            <Scanner />
            <HexShields />
            <DataVault />
            <pointLight position={[0, 0, 5]} color="#ff0000" intensity={5} distance={20} />
        </group>
    );
}
