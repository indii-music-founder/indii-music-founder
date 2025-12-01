'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances, useScroll } from '@react-three/drei';

function DataTunnel() {
    const group = useRef<THREE.Group>(null!);
    const count = 400; // Increased density
    const speed = 20;
    const scroll = useScroll();

    // Material refs for reactive effects
    const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
    const glowMat = useRef<THREE.MeshBasicMaterial>(null!);
    const glowMesh = useRef<THREE.Mesh>(null!);

    // Create data points for the tunnel
    const dataPoints = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => {
            // Spiral distribution
            const angle = (i / count) * Math.PI * 20;
            const radius = 3 + Math.random() * 2;
            const z = (i / count) * 100 - 50; // Spread along Z

            return {
                position: [
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    z
                ] as [number, number, number],
                rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
                scale: Math.random() * 0.5 + 0.2,
                speedOffset: Math.random() * 0.5 + 0.5
            };
        });
    }, []);

    const meshRef = useRef<THREE.InstancedMesh>(null!);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Scroll interaction logic
        // scroll.delta gives us the speed of scrolling (0 to 1 approx)
        // We multiply by a factor to make it sensitive
        const scrollIntensity = Math.min(Math.abs(scroll.delta) * 500, 1);

        // Reactive Beam Effects
        if (beamMat.current) {
            // Pulse opacity: Base 0.8 -> Boost to 1.0
            beamMat.current.opacity = THREE.MathUtils.lerp(0.8, 1.0, scrollIntensity);
            // Color shift: Purple -> White hot
            beamMat.current.color.lerpColors(new THREE.Color('#b026ff'), new THREE.Color('#ffffff'), scrollIntensity * 0.3);
        }

        if (glowMat.current && glowMesh.current) {
            // Pulse glow opacity: Base 0.1 -> Boost to 0.6
            glowMat.current.opacity = THREE.MathUtils.lerp(0.1, 0.6, scrollIntensity);
            // Color shift: Purple -> Cyan/Blue
            glowMat.current.color.lerpColors(new THREE.Color('#b026ff'), new THREE.Color('#00f3ff'), scrollIntensity);

            // Pulse thickness
            const targetScale = 1 + scrollIntensity * 2;
            glowMesh.current.scale.x = THREE.MathUtils.lerp(glowMesh.current.scale.x, targetScale, 0.1);
            glowMesh.current.scale.y = THREE.MathUtils.lerp(glowMesh.current.scale.y, targetScale, 0.1);
        }

        // Update individual instances for infinite flow
        if (meshRef.current) {
            // Increase speed slightly with scroll
            const currentSpeed = speed + (scrollIntensity * 20);

            for (let i = 0; i < count; i++) {
                const data = dataPoints[i];
                const dummy = new THREE.Object3D();

                // Calculate new Z position based on time and speed
                // Loop range: -50 to 50
                let z = data.position[2] + time * currentSpeed * data.speedOffset;
                z = ((z + 50) % 100) - 50;

                dummy.position.set(
                    data.position[0],
                    data.position[1],
                    z
                );
                dummy.rotation.set(
                    data.rotation[0] + time * 0.5 + (scrollIntensity * 0.5), // Spin faster on scroll
                    data.rotation[1] + time * 0.3,
                    data.rotation[2]
                );
                dummy.scale.setScalar(data.scale);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
            }
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <group ref={group}>
            <Instances range={count} ref={meshRef}>
                <boxGeometry args={[0.1, 0.1, 1]} />
                <meshStandardMaterial
                    color="#00f3ff"
                    emissive="#00f3ff"
                    emissiveIntensity={2}
                    toneMapped={false}
                />
                {dataPoints.map((data, i) => (
                    <Instance key={i} />
                ))}
            </Instances>

            {/* Central Beam - Enhanced */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 100, 8]} />
                <meshBasicMaterial ref={beamMat} color="#b026ff" transparent opacity={0.8} />
            </mesh>
            {/* Outer Glow Beam */}
            <mesh ref={glowMesh} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 100, 8]} />
                <meshBasicMaterial ref={glowMat} color="#b026ff" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </group>
    );
}

export default function DeepListening() {
    return (
        <group position={[0, -16, 0]}>
            <fog attach="fog" args={['#000000', 5, 30]} />
            <DataTunnel />
        </group>
    );
}
