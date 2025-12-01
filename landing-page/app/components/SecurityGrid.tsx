'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';

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
            const y = beam.y + Math.sin(t * beam.speed + beam.offset) * 0.2;
            dummy.position.set(0, y, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <boxGeometry args={[30, 0.05, 0.05]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.3} />
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
            <meshBasicMaterial color="#00ff00" transparent opacity={0.1} side={THREE.DoubleSide} />
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
            <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.4} />
            {hexes.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

function DataVault() {
    const group = useRef<THREE.Group>(null!);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        group.current.rotation.y = t * 0.2;
        group.current.position.y = Math.sin(t * 0.5) * 0.5;
    });

    return (
        <group ref={group}>
            {/* Core */}
            <mesh>
                <icosahedronGeometry args={[2, 0]} />
                <meshStandardMaterial
                    color="#00ff00"
                    emissive="#00ff00"
                    emissiveIntensity={0.5}
                    wireframe
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* Inner Glow */}
            <mesh scale={0.8}>
                <icosahedronGeometry args={[2, 2]} />
                <meshBasicMaterial color="#ccffcc" transparent opacity={0.2} />
            </mesh>

            {/* Rotating Rings */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[3, 0.05, 16, 100]} />
                <meshBasicMaterial color="#00ff00" transparent opacity={0.6} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[3.5, 0.02, 16, 100]} />
                <meshBasicMaterial color="#00ff00" transparent opacity={0.4} />
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
            <pointLight position={[0, 0, 5]} color="#00ff00" intensity={2} distance={20} />
        </group>
    );
}
