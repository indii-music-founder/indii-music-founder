'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Points, PointMaterial, Instances, Instance, Float } from '@react-three/drei';
import { useAudioStore } from '../store/audioStore';

function GlobalNetwork() {
    const pointsRef = useRef<THREE.Points>(null!);
    const linesRef = useRef<THREE.LineSegments>(null!);
    const outerPointsRef = useRef<THREE.Points>(null!);

    // Audio Reactivity
    const mid = useAudioStore((state) => state.frequencyData.mid) || 0;

    const count = 250;
    const radius = 6;

    const { positions, linePositions, outerPositions } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const outerPos = new Float32Array(count * 3);
        const vecPositions: THREE.Vector3[] = [];
        const linePos: number[] = [];

        // Inner Sphere
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);
            pos[i * 3] = x;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = z;
            vecPositions.push(new THREE.Vector3(x, y, z));
        }

        // Outer Exosphere (Sparse)
        for (let i = 0; i < count; i++) {
            const r = radius * 1.5;
            const theta = THREE.MathUtils.randFloatSpread(360);
            const phi = THREE.MathUtils.randFloatSpread(360);
            outerPos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
            outerPos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            outerPos[i * 3 + 2] = r * Math.cos(theta);
        }

        // Connections
        vecPositions.forEach((p1, i) => {
            vecPositions.forEach((p2, j) => {
                if (i < j) {
                    const dist = p1.distanceTo(p2);
                    if (dist < 2.5 && Math.random() > 0.85) {
                        linePos.push(p1.x, p1.y, p1.z);
                        linePos.push(p2.x, p2.y, p2.z);
                    }
                }
            });
        });

        if (linePos.length === 0) linePos.push(0, 0, 0, 0, 0, 0);

        return { positions: pos, linePositions: new Float32Array(linePos), outerPositions: outerPos };
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const pulse = 1 + mid * 0.3;

        // Inner Sphere
        if (pointsRef.current) {
            pointsRef.current.rotation.y = t * 0.1;
            pointsRef.current.scale.setScalar(pulse);
        }
        if (linesRef.current) {
            linesRef.current.rotation.y = t * 0.1;
            linesRef.current.scale.setScalar(pulse);
        }

        // Outer Exosphere (Reverse Spin)
        if (outerPointsRef.current) {
            outerPointsRef.current.rotation.y = -t * 0.05;
            outerPointsRef.current.rotation.x = Math.sin(t * 0.1) * 0.1;
        }
    });

    return (
        <group>
            {/* Inner Nodes */}
            <Points ref={pointsRef} positions={positions} stride={3}>
                <PointMaterial transparent color="#00ff9d" size={0.15} sizeAttenuation={true} depthWrite={false} />
            </Points>

            {/* Connections */}
            <lineSegments ref={linesRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} args={[linePositions, 3]} />
                </bufferGeometry>
                <lineBasicMaterial color="#00ff9d" transparent opacity={0.15} blending={THREE.AdditiveBlending} />
            </lineSegments>

            {/* Outer Exosphere */}
            <Points ref={outerPointsRef} positions={outerPositions} stride={3}>
                <PointMaterial transparent color="#008855" size={0.1} sizeAttenuation={true} depthWrite={false} opacity={0.6} />
            </Points>

            {/* Core Glow */}
            <mesh>
                <sphereGeometry args={[radius * 0.6, 32, 32]} />
                <meshBasicMaterial color="#002211" transparent opacity={0.8} side={THREE.BackSide} />
            </mesh>
        </group>
    );
}

function OrbitalClusters() {
    const group = useRef<THREE.Group>(null!);
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 40;

    const particles = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => ({
            angle: (i / count) * Math.PI * 2,
            radius: 12 + Math.random() * 4,
            speed: Math.random() * 0.2 + 0.1,
            y: (Math.random() - 0.5) * 4
        }));
    }, []);

    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        particles.forEach((p, i) => {
            const angle = p.angle + t * p.speed;
            const x = Math.cos(angle) * p.radius;
            const z = Math.sin(angle) * p.radius;

            dummy.position.set(x, p.y + Math.sin(t + i) * 2, z);
            dummy.rotation.set(t, t, t);
            dummy.scale.setScalar(Math.random() * 0.5 + 0.5);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <group ref={group} rotation={[0.2, 0, 0.2]}>
            <Instances range={count} ref={meshRef}>
                <octahedronGeometry args={[0.4]} />
                <meshBasicMaterial color="#00ff9d" wireframe />
                {particles.map((_, i) => <Instance key={i} />)}
            </Instances>
        </group>
    );
}

export default function Business() {
    return (
        <group position={[0, -60, 0]}>
            <GlobalNetwork />
            <OrbitalClusters />

            {/* Geospatial Grid */}
            <gridHelper args={[60, 20, 0x004422, 0x002211]} position={[0, -10, 0]} />

            <pointLight position={[10, 10, 10]} color="#00ff9d" intensity={2} distance={20} />
            <ambientLight intensity={0.2} color="#004422" />
        </group>
    );
}
