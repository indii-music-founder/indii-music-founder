'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';

function DataStorm() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 600;

    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            // Spiral distribution
            angle: Math.random() * Math.PI * 2,
            radius: Math.random() * 5 + 2,
            y: (Math.random() - 0.5) * 10,
            speed: Math.random() * 0.5 + 0.2,
            scale: Math.random() * 0.2 + 0.05
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        particles.forEach((p, i) => {
            // Vortex motion
            const currentAngle = p.angle + t * p.speed;
            const r = p.radius + Math.sin(t * 2 + i) * 0.5; // Pulsing radius

            const x = Math.cos(currentAngle) * r;
            const z = Math.sin(currentAngle) * r;
            const y = p.y + Math.cos(t + i) * 0.5; // Bobbing

            dummy.position.set(x, y, z);

            // Rotate to face center/tangent
            dummy.lookAt(0, y, 0);
            dummy.rotateY(Math.PI / 2);
            dummy.rotateZ(t * 2 + i); // Spin

            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <tetrahedronGeometry args={[1]} />
            <meshBasicMaterial color="#ff00ff" toneMapped={false} transparent opacity={0.6} />
            {particles.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

function CoreReactor() {
    const mesh = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.rotation.x = t * 0.5;
        mesh.current.rotation.y = t * 0.3;
        const scale = 1 + Math.sin(t * 4) * 0.1;
        mesh.current.scale.setScalar(scale);
    });

    return (
        <mesh ref={mesh}>
            <octahedronGeometry args={[1.5, 0]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.5} />
        </mesh>
    );
}

export default function NeuralForge() {
    return (
        <group position={[0, -36, 0]}> {/* Positioned between Agent Zero (-32) and Business (will be -64) */}
            <ambientLight intensity={0.5} />
            <pointLight position={[0, 0, 0]} intensity={5} color="#ff00ff" distance={10} />

            <DataStorm />
            <CoreReactor />
        </group>
    );
}
