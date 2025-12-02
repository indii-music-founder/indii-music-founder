'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { useAudioStore } from '../store/audioStore';

const COUNT = 40;
const SPEED_FACTOR = 0.5;

// Reusing the logic from LiquidOrbs but adapting for 3D
// Orbs will float up from the bottom

export default function ThreeDOrbs() {
    const { viewport, camera } = useThree();
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const noise2D = useMemo(() => createNoise2D(), []);

    // Subscribe to audio store
    const freqDataRef = useRef({ bass: 0, mid: 0, high: 0 });
    useEffect(() => {
        return useAudioStore.subscribe((state) => {
            freqDataRef.current = state.frequencyData;
        });
    }, []);

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < COUNT; i++) {
            const scale = Math.random() * 0.5 + 0.2; // Base size
            temp.push({
                // Start at random x, well below the view in y, random z depth
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * viewport.width * 1.5,
                    -viewport.height / 2 - Math.random() * 10,
                    (Math.random() - 0.5) * 5 // Depth
                ),
                scale,
                baseScale: scale,
                speed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * 1000,
                color: new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.8, 0.5) // Cyan to Purple
            });
        }
        return temp;
    }, [viewport]);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    useFrame((state, delta) => {
        const { bass, mid, high } = freqDataRef.current;
        const time = state.clock.elapsedTime;

        // We want the orbs to stay relative to the camera's view, 
        // effectively acting like a background layer even though the camera moves.
        // However, if we just parent them to the camera, they will move WITH the camera.
        // If we want them to float up through the "world", we can let them be world-space.
        // But since the camera moves down significantly (scroll * 96), we might lose them.
        // Let's make them follow the camera Y but float up relative to it.

        const cameraY = camera.position.y;

        particles.forEach((particle, i) => {
            // 1. Update Position
            // Float up
            particle.position.y += particle.speed * (1 + high * 2);

            // Noise movement
            const nX = noise2D(particle.offset + time * 0.1, 0);
            const nZ = noise2D(0, particle.offset + time * 0.1);

            particle.position.x += nX * 0.01;
            particle.position.z += nZ * 0.01;

            // Wrap around logic relative to camera
            const topBound = cameraY + viewport.height / 2 + 2;
            const bottomBound = cameraY - viewport.height / 2 - 5;

            if (particle.position.y > topBound) {
                particle.position.y = bottomBound;
                particle.position.x = (Math.random() - 0.5) * viewport.width * 1.5;
            }
            // Also if it falls too far behind (shouldn't happen with upward movement but good safety)
            if (particle.position.y < bottomBound - 10) {
                particle.position.y = bottomBound;
            }

            // 2. Audio Reactivity
            // Scale pulse with bass
            const targetScale = particle.baseScale * (1 + bass * 0.5);
            // Smooth lerp
            particle.scale = THREE.MathUtils.lerp(particle.scale, targetScale, 0.1);

            // 3. Update Matrix
            dummy.position.copy(particle.position);
            dummy.scale.setScalar(particle.scale);
            dummy.rotation.x += 0.01;
            dummy.rotation.y += 0.01;
            dummy.updateMatrix();

            meshRef.current.setMatrixAt(i, dummy.matrix);

            // 4. Update Color & Emissive
            // Shift hue with mid, increase brightness with high
            const hue = (0.6 + mid * 0.2 + Math.sin(time * 0.1 + particle.offset) * 0.1) % 1;
            const lightness = 0.5 + high * 0.5; // Pulse brightness

            color.setHSL(hue, 0.9, lightness);

            // We can't easily set per-instance emissive on a single material without custom shaders or using the color attribute as emissive tint if configured.
            // But standard meshPhysicalMaterial uses instanceColor for albedo.
            // To get a "glow", we rely on the high lightness pushing into Bloom threshold (usually > 1).
            // Let's boost the color values above 1.0 for the bloom effect.

            if (high > 0.5) {
                color.multiplyScalar(1 + high * 2); // Super bright for bloom
            }

            meshRef.current.setColorAt(i, color);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <group>
            <Environment preset="city" />
            <Instances range={COUNT} ref={meshRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhysicalMaterial
                    roughness={0.15}
                    metalness={0.2}
                    transmission={0.95}
                    thickness={2.0}
                    ior={1.45}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    attenuationDistance={0.8}
                    attenuationColor="#ffffff"
                    color="#ffffff"
                    iridescence={1}
                    iridescenceIOR={1.3}
                    iridescenceThicknessRange={[0, 1400]}
                    dispersion={5} // Chromatic aberration
                />
                {particles.map((_, i) => (
                    <Instance key={i} />
                ))}
            </Instances>
        </group>
    );
}
