'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioStore, audioStore } from '../store/audioStore';

const COUNT = 200;

export default function OrigamiParticles() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    // Generate particles
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < COUNT; i++) {
            const t = Math.random() * 100;
            const factor = 20 + Math.random() * 100;
            const speed = 0.01 + Math.random() / 200;
            const xFactor = -50 + Math.random() * 100;
            const yFactor = -50 + Math.random() * 100;
            const zFactor = -50 + Math.random() * 100;

            // Randomize starting rotation
            const rotation = new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            temp.push({
                t,
                factor,
                speed,
                xFactor,
                yFactor,
                zFactor,
                rotation,
                // Assign a "flight path" radius and offset
                radius: 5 + Math.random() * 10,
                yOffset: (Math.random() - 0.5) * 20,
                angle: Math.random() * Math.PI * 2
            });
        }
        return temp;
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const { frequencyData } = audioStore.getState();
        const { high } = frequencyData; // React to high freq (cymbals/snares)

        particles.forEach((p, i) => {
            // Swirling motion logic
            // Update angle based on speed
            p.angle += p.speed * (1 + high * 2); // Speed up on beat

            // Calculate position on a spiral/cylinder
            const x = Math.cos(p.angle) * p.radius;
            const z = Math.sin(p.angle) * p.radius;
            const y = p.yOffset + Math.sin(t * 0.5 + p.t) * 5; // Bobbing up and down

            dummy.position.set(x, y, z);

            // Orient "paper plane" to face direction of travel
            // Tangent vector is (-sin, 0, cos)
            const lookAtPos = new THREE.Vector3(
                Math.cos(p.angle + 0.1) * p.radius,
                y,
                Math.sin(p.angle + 0.1) * p.radius
            );
            dummy.lookAt(lookAtPos);

            // Add some banking/rolling
            dummy.rotateZ(Math.sin(t * 2 + p.t) * 0.5);

            // Audio reactive scale
            const scale = 1 + high * 0.5;
            dummy.scale.set(scale, scale, scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // Color shift logic (Pink/Purple origami)
            // Base pink: #ff69b4
            // Shift to white/bright on beat
            const color = new THREE.Color('#ff69b4');
            if (high > 0.2) {
                color.lerp(new THREE.Color('#ffffff'), high);
            }
            meshRef.current.setColorAt(i, color);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <Instances range={COUNT} ref={meshRef}>
            {/* ConeGeometry(radius, height, radialSegments) -> 4 segments = pyramid/dart shape */}
            <coneGeometry args={[0.2, 0.8, 4]} />
            <meshStandardMaterial
                roughness={0.9} // Paper is rough
                metalness={0.0} // Paper is not metallic
                side={THREE.DoubleSide}
                flatShading={true} // Low poly look
            />
            {particles.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}
